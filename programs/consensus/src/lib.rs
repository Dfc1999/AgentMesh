#![deny(clippy::all)]

use anchor_lang::prelude::*;
use task_escrow::program::TaskEscrow;

declare_id!("11111111111111111111111111111111");

pub const CONSENSUS_SEED: &[u8] = b"consensus";
pub const CONSENSUS_AUTHORITY_SEED: &[u8] = b"consensus_authority";
pub const MAX_VALIDATORS: usize = 5;

#[program]
pub mod consensus {
    use super::*;

    pub fn initialize_consensus(
        ctx: Context<InitializeConsensus>,
        required_signatures: u8,
        validators: Vec<Pubkey>,
        dispute_deadline_slot: u64,
    ) -> Result<()> {
        require!(
            !validators.is_empty() && validators.len() <= MAX_VALIDATORS,
            ConsensusError::InvalidValidatorSet
        );
        require!(
            required_signatures > 0 && required_signatures as usize <= validators.len(),
            ConsensusError::InvalidSignatureThreshold
        );

        let worker = ctx
            .accounts
            .subtask
            .worker
            .ok_or(ConsensusError::WorkerNotAssigned)?;
        require!(
            !validators.contains(&worker),
            ConsensusError::WorkerCannotValidateOwnWork
        );

        for (index, validator) in validators.iter().enumerate() {
            require!(
                validators[index + 1..].iter().all(|candidate| candidate != validator),
                ConsensusError::DuplicateValidator
            );
        }

        let consensus = &mut ctx.accounts.consensus;
        consensus.subtask = ctx.accounts.subtask.key();
        consensus.task = ctx.accounts.subtask.task;
        consensus.creator = ctx.accounts.task.creator;
        consensus.worker = worker;
        consensus.required_signatures = required_signatures;
        consensus.total_validators = validators.len() as u8;
        consensus.validators = validators;
        consensus.signatures = Vec::new();
        consensus.status = ConsensusStatus::Pending;
        consensus.dispute_deadline_slot = dispute_deadline_slot;
        consensus.bump = ctx.bumps.consensus;
        consensus.authority_bump = ctx.bumps.consensus_authority;

        emit!(ConsensusInitialized {
            consensus: consensus.key(),
            task: consensus.task,
            subtask: consensus.subtask,
            required_signatures,
            total_validators: consensus.total_validators,
            dispute_deadline_slot,
        });

        Ok(())
    }

    pub fn submit_validation(
        ctx: Context<SubmitValidation>,
        approved: bool,
        justification_hash: [u8; 32],
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.consensus_program.key(),
            crate::ID,
            ConsensusError::InvalidConsensusProgram
        );
        require!(
            ctx.accounts.consensus.status == ConsensusStatus::Pending,
            ConsensusError::ConsensusNotPending
        );
        require!(
            ctx.accounts.consensus.validators.contains(&ctx.accounts.validator.key()),
            ConsensusError::ValidatorNotAllowed
        );
        require_keys_neq!(
            ctx.accounts.validator.key(),
            ctx.accounts.consensus.worker,
            ConsensusError::WorkerCannotValidateOwnWork
        );
        require!(
            ctx.accounts
                .consensus
                .signatures
                .iter()
                .all(|sig| sig.validator != ctx.accounts.validator.key()),
            ConsensusError::ValidatorAlreadySigned
        );
        require!(
            ctx.accounts.consensus.signatures.len()
                < ctx.accounts.consensus.total_validators as usize,
            ConsensusError::SignatureSetFull
        );

        ctx.accounts.consensus.signatures.push(ValidatorSig {
            validator: ctx.accounts.validator.key(),
            approved,
            justification_hash,
            slot: Clock::get()?.slot,
        });

        emit!(ValidationSubmitted {
            consensus: ctx.accounts.consensus.key(),
            subtask: ctx.accounts.consensus.subtask,
            validator: ctx.accounts.validator.key(),
            approved,
            justification_hash,
        });

        if ctx.accounts.consensus.approved_count() >= ctx.accounts.consensus.required_signatures {
            ctx.accounts.consensus.status = ConsensusStatus::Approved;

            let subtask_key = ctx.accounts.subtask.key();
            let bump = ctx.accounts.consensus.authority_bump;
            let bump_seed = [bump];
            let signer_seeds: &[&[&[u8]]] = &[&[
                CONSENSUS_AUTHORITY_SEED,
                subtask_key.as_ref(),
                &bump_seed,
            ]];

            let cpi_accounts = task_escrow::cpi::accounts::CompleteSubtask {
                consensus_authority: ctx.accounts.consensus_authority.to_account_info(),
                consensus_program: ctx.accounts.consensus_program.to_account_info(),
                subtask: ctx.accounts.subtask.to_account_info(),
                task: ctx.accounts.task.to_account_info(),
                task_vault: ctx.accounts.task_vault.to_account_info(),
                worker: ctx.accounts.worker.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.task_escrow_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            );
            task_escrow::cpi::complete_subtask(cpi_ctx, bump)?;

            emit!(ConsensusApproved {
                consensus: ctx.accounts.consensus.key(),
                subtask: ctx.accounts.consensus.subtask,
                approved_count: ctx.accounts.consensus.approved_count(),
            });
        }

        Ok(())
    }

    pub fn dispute_result(ctx: Context<CreatorAction>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.creator.key(),
            ctx.accounts.consensus.creator,
            ConsensusError::UnauthorizedCreator
        );
        require!(
            Clock::get()?.slot <= ctx.accounts.consensus.dispute_deadline_slot,
            ConsensusError::DisputeWindowClosed
        );
        require!(
            ctx.accounts.consensus.status == ConsensusStatus::Pending
                || ctx.accounts.consensus.status == ConsensusStatus::Approved,
            ConsensusError::InvalidConsensusStatus
        );

        ctx.accounts.consensus.status = ConsensusStatus::Disputed;

        emit!(ConsensusDisputed {
            consensus: ctx.accounts.consensus.key(),
            subtask: ctx.accounts.consensus.subtask,
            creator: ctx.accounts.creator.key(),
        });

        Ok(())
    }

    pub fn veto_result(ctx: Context<CreatorAction>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.creator.key(),
            ctx.accounts.consensus.creator,
            ConsensusError::UnauthorizedCreator
        );
        require!(
            Clock::get()?.slot <= ctx.accounts.consensus.dispute_deadline_slot,
            ConsensusError::DisputeWindowClosed
        );

        ctx.accounts.consensus.status = ConsensusStatus::Vetoed;

        emit!(ConsensusVetoed {
            consensus: ctx.accounts.consensus.key(),
            subtask: ctx.accounts.consensus.subtask,
            creator: ctx.accounts.creator.key(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConsensus<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub task: Account<'info, task_escrow::TaskAccount>,
    #[account(
        constraint = subtask.task == task.key() @ ConsensusError::TaskMismatch,
        constraint = subtask.status == task_escrow::SubtaskStatus::ResultSubmitted @ ConsensusError::SubtaskNotReady
    )]
    pub subtask: Account<'info, task_escrow::SubtaskAccount>,
    #[account(
        init,
        payer = payer,
        space = 8 + ConsensusAccount::INIT_SPACE,
        seeds = [CONSENSUS_SEED, subtask.key().as_ref()],
        bump
    )]
    pub consensus: Account<'info, ConsensusAccount>,
    /// CHECK: PDA authority used by this program to approve Task Escrow completion.
    #[account(
        seeds = [CONSENSUS_AUTHORITY_SEED, subtask.key().as_ref()],
        bump
    )]
    pub consensus_authority: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitValidation<'info> {
    pub validator: Signer<'info>,
    /// CHECK: this must be the currently executing consensus program id.
    pub consensus_program: UncheckedAccount<'info>,
    /// CHECK: PDA authority used as signer for Task Escrow CPI.
    #[account(
        seeds = [CONSENSUS_AUTHORITY_SEED, subtask.key().as_ref()],
        bump = consensus.authority_bump
    )]
    pub consensus_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [CONSENSUS_SEED, subtask.key().as_ref()],
        bump = consensus.bump,
        constraint = consensus.subtask == subtask.key() @ ConsensusError::SubtaskMismatch
    )]
    pub consensus: Account<'info, ConsensusAccount>,
    #[account(mut)]
    pub task: Account<'info, task_escrow::TaskAccount>,
    #[account(
        mut,
        constraint = subtask.task == task.key() @ ConsensusError::TaskMismatch
    )]
    pub subtask: Account<'info, task_escrow::SubtaskAccount>,
    /// CHECK: Task Escrow lamport vault.
    #[account(mut)]
    pub task_vault: UncheckedAccount<'info>,
    /// CHECK: verified by Task Escrow against subtask.worker.
    #[account(mut)]
    pub worker: UncheckedAccount<'info>,
    pub task_escrow_program: Program<'info, TaskEscrow>,
}

#[derive(Accounts)]
pub struct CreatorAction<'info> {
    pub creator: Signer<'info>,
    #[account(mut)]
    pub consensus: Account<'info, ConsensusAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct ConsensusAccount {
    pub subtask: Pubkey,
    pub task: Pubkey,
    pub creator: Pubkey,
    pub worker: Pubkey,
    pub required_signatures: u8,
    pub total_validators: u8,
    #[max_len(5)]
    pub validators: Vec<Pubkey>,
    #[max_len(5)]
    pub signatures: Vec<ValidatorSig>,
    pub status: ConsensusStatus,
    pub dispute_deadline_slot: u64,
    pub bump: u8,
    pub authority_bump: u8,
}

impl ConsensusAccount {
    pub fn approved_count(&self) -> u8 {
        self.signatures
            .iter()
            .filter(|signature| signature.approved)
            .count() as u8
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace)]
pub struct ValidatorSig {
    pub validator: Pubkey,
    pub approved: bool,
    pub justification_hash: [u8; 32],
    pub slot: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ConsensusStatus {
    Pending,
    Approved,
    Disputed,
    Vetoed,
}

#[event]
pub struct ConsensusInitialized {
    pub consensus: Pubkey,
    pub task: Pubkey,
    pub subtask: Pubkey,
    pub required_signatures: u8,
    pub total_validators: u8,
    pub dispute_deadline_slot: u64,
}

#[event]
pub struct ValidationSubmitted {
    pub consensus: Pubkey,
    pub subtask: Pubkey,
    pub validator: Pubkey,
    pub approved: bool,
    pub justification_hash: [u8; 32],
}

#[event]
pub struct ConsensusApproved {
    pub consensus: Pubkey,
    pub subtask: Pubkey,
    pub approved_count: u8,
}

#[event]
pub struct ConsensusDisputed {
    pub consensus: Pubkey,
    pub subtask: Pubkey,
    pub creator: Pubkey,
}

#[event]
pub struct ConsensusVetoed {
    pub consensus: Pubkey,
    pub subtask: Pubkey,
    pub creator: Pubkey,
}

#[error_code]
pub enum ConsensusError {
    #[msg("Validator set must contain 1 to 5 validators")]
    InvalidValidatorSet,
    #[msg("Required signatures must be between 1 and validator count")]
    InvalidSignatureThreshold,
    #[msg("Duplicate validators are not allowed")]
    DuplicateValidator,
    #[msg("Subtask worker has not been assigned")]
    WorkerNotAssigned,
    #[msg("Worker cannot validate its own subtask")]
    WorkerCannotValidateOwnWork,
    #[msg("Subtask does not belong to task")]
    TaskMismatch,
    #[msg("Subtask is not ready for consensus")]
    SubtaskNotReady,
    #[msg("Consensus account does not match subtask")]
    SubtaskMismatch,
    #[msg("Consensus account is not pending")]
    ConsensusNotPending,
    #[msg("Validator is not part of this consensus set")]
    ValidatorNotAllowed,
    #[msg("Validator already signed this consensus")]
    ValidatorAlreadySigned,
    #[msg("All validator signature slots are already filled")]
    SignatureSetFull,
    #[msg("Invalid consensus program account")]
    InvalidConsensusProgram,
    #[msg("Only the task creator can perform this action")]
    UnauthorizedCreator,
    #[msg("Dispute window is closed")]
    DisputeWindowClosed,
    #[msg("Consensus status does not allow this action")]
    InvalidConsensusStatus,
}
