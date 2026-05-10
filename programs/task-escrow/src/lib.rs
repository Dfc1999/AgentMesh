#![deny(clippy::all)]
#![allow(deprecated)]

use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

pub const TASK_SEED: &[u8] = b"task";
pub const SUBTASK_SEED: &[u8] = b"subtask";
pub const CONSENSUS_AUTHORITY_SEED: &[u8] = b"consensus_authority";

#[program]
pub mod task_escrow {
    use super::*;

    pub fn create_task(
        ctx: Context<CreateTask>,
        task_id: u64,
        brief_hash: [u8; 32],
        budget: u64,
        timeout_slots: u64,
    ) -> Result<()> {
        require!(budget > 0, TaskEscrowError::InvalidBudget);
        require!(timeout_slots > 0, TaskEscrowError::InvalidTimeout);

        let task = &mut ctx.accounts.task;
        task.creator = ctx.accounts.creator.key();
        task.task_id = task_id;
        task.brief_hash = brief_hash;
        task.total_budget = budget;
        task.allocated_budget = 0;
        task.status = TaskStatus::Pending;
        task.orchestrator = None;
        task.created_at = Clock::get()?.unix_timestamp;
        task.timeout_slots = timeout_slots;
        task.bump = ctx.bumps.task;

        let transfer_accounts = anchor_lang::system_program::Transfer {
            from: ctx.accounts.creator.to_account_info(),
            to: ctx.accounts.task_vault.to_account_info(),
        };
        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_accounts,
        );
        anchor_lang::system_program::transfer(transfer_ctx, budget)?;

        emit!(TaskCreated {
            task: task.key(),
            creator: task.creator,
            task_id,
            budget,
            timeout_slots,
        });

        Ok(())
    }

    pub fn assign_orchestrator(
        ctx: Context<AssignOrchestrator>,
        orchestrator_pubkey: Pubkey,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.creator.key(),
            ctx.accounts.task.creator,
            TaskEscrowError::UnauthorizedCreator
        );
        require!(
            ctx.accounts.task.status == TaskStatus::Pending
                || ctx.accounts.task.status == TaskStatus::Active,
            TaskEscrowError::InvalidTaskStatus
        );

        let task = &mut ctx.accounts.task;
        task.orchestrator = Some(orchestrator_pubkey);
        task.status = TaskStatus::Active;

        emit!(OrchestratorAssigned {
            task: task.key(),
            orchestrator: orchestrator_pubkey,
        });

        Ok(())
    }

    pub fn allocate_subtask(
        ctx: Context<AllocateSubtask>,
        subtask_index: u32,
        parent_subtask: Option<Pubkey>,
        budget: u64,
        max_retry_spend: u64,
        timeout_slot: u64,
    ) -> Result<()> {
        require!(budget > 0, TaskEscrowError::InvalidBudget);
        require!(
            max_retry_spend <= budget,
            TaskEscrowError::RetryBudgetExceedsAllocation
        );
        require!(
            ctx.accounts.task.status == TaskStatus::Active
                || ctx.accounts.task.status == TaskStatus::Pending,
            TaskEscrowError::InvalidTaskStatus
        );

        if let Some(orchestrator) = ctx.accounts.task.orchestrator {
            require_keys_eq!(
                ctx.accounts.authority.key(),
                orchestrator,
                TaskEscrowError::UnauthorizedOrchestrator
            );
        } else {
            require_keys_eq!(
                ctx.accounts.authority.key(),
                ctx.accounts.task.creator,
                TaskEscrowError::UnauthorizedCreator
            );
        }

        let new_total = ctx
            .accounts
            .task
            .allocated_budget
            .checked_add(budget)
            .ok_or(TaskEscrowError::ArithmeticOverflow)?;
        require!(
            new_total <= ctx.accounts.task.total_budget,
            TaskEscrowError::BudgetExceeded
        );

        ctx.accounts.task.allocated_budget = new_total;
        ctx.accounts.task.status = TaskStatus::Active;

        let subtask = &mut ctx.accounts.subtask;
        subtask.task = ctx.accounts.task.key();
        subtask.subtask_index = subtask_index;
        subtask.parent_subtask = parent_subtask;
        subtask.worker = None;
        subtask.allocated_budget = budget;
        subtask.spent_retry_budget = 0;
        subtask.max_retry_spend = max_retry_spend;
        subtask.declared_tier = None;
        subtask.result_hash = None;
        subtask.status = SubtaskStatus::Allocated;
        subtask.timeout_slot = timeout_slot;
        subtask.retry_count = 0;
        subtask.bump = ctx.bumps.subtask;

        emit!(SubtaskAllocated {
            task: ctx.accounts.task.key(),
            subtask: subtask.key(),
            subtask_index,
            parent_subtask,
            budget,
            max_retry_spend,
            timeout_slot,
        });

        Ok(())
    }

    pub fn declare_tier(
        ctx: Context<DeclareTier>,
        tier: Tier,
        worker: Pubkey,
    ) -> Result<()> {
        require!(
            ctx.accounts.subtask.status == SubtaskStatus::Allocated
                || ctx.accounts.subtask.status == SubtaskStatus::Retried,
            TaskEscrowError::InvalidSubtaskStatus
        );

        let subtask = &mut ctx.accounts.subtask;
        subtask.declared_tier = Some(tier);
        subtask.worker = Some(worker);
        subtask.status = SubtaskStatus::TierDeclared;

        emit!(TierDeclared {
            task: subtask.task,
            subtask: subtask.key(),
            tier,
            worker,
        });

        Ok(())
    }

    pub fn submit_result(
        ctx: Context<SubmitResult>,
        result_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.subtask.status == SubtaskStatus::TierDeclared
                || ctx.accounts.subtask.status == SubtaskStatus::Retried,
            TaskEscrowError::InvalidSubtaskStatus
        );
        require_keys_eq!(
            ctx.accounts.worker.key(),
            ctx.accounts
                .subtask
                .worker
                .ok_or(TaskEscrowError::WorkerNotAssigned)?,
            TaskEscrowError::UnauthorizedWorker
        );

        let subtask = &mut ctx.accounts.subtask;
        subtask.result_hash = Some(result_hash);
        subtask.status = SubtaskStatus::ResultSubmitted;

        emit!(ResultSubmitted {
            task: subtask.task,
            subtask: subtask.key(),
            worker: ctx.accounts.worker.key(),
            result_hash,
        });

        Ok(())
    }

    pub fn complete_subtask(
        ctx: Context<CompleteSubtask>,
        consensus_authority_bump: u8,
    ) -> Result<()> {
        require!(
            ctx.accounts.subtask.status == SubtaskStatus::ResultSubmitted,
            TaskEscrowError::InvalidSubtaskStatus
        );
        let worker = ctx
            .accounts
            .subtask
            .worker
            .ok_or(TaskEscrowError::WorkerNotAssigned)?;
        require_keys_eq!(
            ctx.accounts.worker.key(),
            worker,
            TaskEscrowError::InvalidWorkerAccount
        );
        require!(
            ctx.accounts.subtask.result_hash.is_some(),
            TaskEscrowError::MissingResult
        );

        let expected_authority = Pubkey::create_program_address(
            &[
                CONSENSUS_AUTHORITY_SEED,
                ctx.accounts.subtask.key().as_ref(),
                &[consensus_authority_bump],
            ],
            &ctx.accounts.consensus_program.key(),
        )
        .map_err(|_| TaskEscrowError::InvalidConsensusAuthority)?;
        require_keys_eq!(
            expected_authority,
            ctx.accounts.consensus_authority.key(),
            TaskEscrowError::InvalidConsensusAuthority
        );
        require!(
            ctx.accounts.consensus_authority.to_account_info().is_signer,
            TaskEscrowError::MissingConsensusSignature
        );

        let amount = ctx.accounts.subtask.allocated_budget;
        let vault_info = ctx.accounts.task_vault.to_account_info();
        let worker_info = ctx.accounts.worker.to_account_info();
        require!(
            **vault_info.lamports.borrow() >= amount,
            TaskEscrowError::VaultInsufficientFunds
        );

        **vault_info.try_borrow_mut_lamports()? = vault_info
            .lamports()
            .checked_sub(amount)
            .ok_or(TaskEscrowError::ArithmeticOverflow)?;
        **worker_info.try_borrow_mut_lamports()? = worker_info
            .lamports()
            .checked_add(amount)
            .ok_or(TaskEscrowError::ArithmeticOverflow)?;

        ctx.accounts.subtask.status = SubtaskStatus::Completed;

        emit!(SubtaskCompleted {
            task: ctx.accounts.subtask.task,
            subtask: ctx.accounts.subtask.key(),
            worker,
            amount,
        });

        Ok(())
    }

    pub fn retry_subtask(
        ctx: Context<RetrySubtask>,
        new_tier: Tier,
        new_worker: Pubkey,
        retry_spend: u64,
    ) -> Result<()> {
        require!(
            ctx.accounts.subtask.status == SubtaskStatus::ResultSubmitted
                || ctx.accounts.subtask.status == SubtaskStatus::TierDeclared,
            TaskEscrowError::InvalidSubtaskStatus
        );

        let next_retry_spend = ctx
            .accounts
            .subtask
            .spent_retry_budget
            .checked_add(retry_spend)
            .ok_or(TaskEscrowError::ArithmeticOverflow)?;
        require!(
            next_retry_spend <= ctx.accounts.subtask.max_retry_spend,
            TaskEscrowError::RetryBudgetExceeded
        );

        let subtask = &mut ctx.accounts.subtask;
        subtask.declared_tier = Some(new_tier);
        subtask.worker = Some(new_worker);
        subtask.result_hash = None;
        subtask.status = SubtaskStatus::Retried;
        subtask.spent_retry_budget = next_retry_spend;
        subtask.retry_count = subtask
            .retry_count
            .checked_add(1)
            .ok_or(TaskEscrowError::ArithmeticOverflow)?;

        emit!(SubtaskRetried {
            task: subtask.task,
            subtask: subtask.key(),
            new_tier,
            new_worker,
            retry_spend,
            spent_retry_budget: next_retry_spend,
        });

        Ok(())
    }

    pub fn claim_timeout_refund(ctx: Context<ClaimTimeoutRefund>) -> Result<()> {
        let current_slot = Clock::get()?.slot;
        require!(
            current_slot > ctx.accounts.subtask.timeout_slot,
            TaskEscrowError::TimeoutNotReached
        );
        require!(
            ctx.accounts.subtask.status != SubtaskStatus::Completed,
            TaskEscrowError::InvalidSubtaskStatus
        );
        require!(
            ctx.accounts.subtask.result_hash.is_none(),
            TaskEscrowError::ResultAlreadySubmitted
        );

        ctx.accounts.subtask.worker = None;
        ctx.accounts.subtask.declared_tier = None;
        ctx.accounts.subtask.status = SubtaskStatus::TimedOut;

        emit!(TimeoutClaimed {
            task: ctx.accounts.subtask.task,
            subtask: ctx.accounts.subtask.key(),
            claimant: ctx.accounts.claimant.key(),
            slot: current_slot,
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(task_id: u64)]
pub struct CreateTask<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + TaskAccount::INIT_SPACE,
        seeds = [TASK_SEED, creator.key().as_ref(), &task_id.to_le_bytes()],
        bump
    )]
    pub task: Account<'info, TaskAccount>,
    /// CHECK: PDA lamport vault owned by this program. It stores escrowed SOL and no data.
    #[account(
        init,
        payer = creator,
        space = 0,
        seeds = [b"task_vault", task.key().as_ref()],
        bump
    )]
    pub task_vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AssignOrchestrator<'info> {
    pub creator: Signer<'info>,
    #[account(mut, has_one = creator @ TaskEscrowError::UnauthorizedCreator)]
    pub task: Account<'info, TaskAccount>,
}

#[derive(Accounts)]
#[instruction(subtask_index: u32)]
pub struct AllocateSubtask<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub task: Account<'info, TaskAccount>,
    #[account(
        init,
        payer = authority,
        space = 8 + SubtaskAccount::INIT_SPACE,
        seeds = [
            SUBTASK_SEED,
            task.key().as_ref(),
            &subtask_index.to_le_bytes()
        ],
        bump
    )]
    pub subtask: Account<'info, SubtaskAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeclareTier<'info> {
    pub router: Signer<'info>,
    #[account(mut, has_one = task @ TaskEscrowError::TaskMismatch)]
    pub subtask: Account<'info, SubtaskAccount>,
    pub task: Account<'info, TaskAccount>,
}

#[derive(Accounts)]
pub struct SubmitResult<'info> {
    pub worker: Signer<'info>,
    #[account(mut, has_one = task @ TaskEscrowError::TaskMismatch)]
    pub subtask: Account<'info, SubtaskAccount>,
    pub task: Account<'info, TaskAccount>,
}

#[derive(Accounts)]
pub struct CompleteSubtask<'info> {
    /// CHECK: PDA signer derived by the consensus program for this subtask.
    pub consensus_authority: UncheckedAccount<'info>,
    /// CHECK: consensus program account used as PDA program id until concrete program ids are configured.
    pub consensus_program: UncheckedAccount<'info>,
    #[account(mut, has_one = task @ TaskEscrowError::TaskMismatch)]
    pub subtask: Account<'info, SubtaskAccount>,
    pub task: Account<'info, TaskAccount>,
    /// CHECK: task vault PDA containing escrow lamports.
    #[account(mut, seeds = [b"task_vault", task.key().as_ref()], bump)]
    pub task_vault: UncheckedAccount<'info>,
    /// CHECK: verified against subtask.worker.
    #[account(mut)]
    pub worker: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RetrySubtask<'info> {
    pub judge: Signer<'info>,
    #[account(mut, has_one = task @ TaskEscrowError::TaskMismatch)]
    pub subtask: Account<'info, SubtaskAccount>,
    pub task: Account<'info, TaskAccount>,
}

#[derive(Accounts)]
pub struct ClaimTimeoutRefund<'info> {
    #[account(mut)]
    pub claimant: Signer<'info>,
    #[account(mut, has_one = task @ TaskEscrowError::TaskMismatch)]
    pub subtask: Account<'info, SubtaskAccount>,
    pub task: Account<'info, TaskAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct TaskAccount {
    pub creator: Pubkey,
    pub task_id: u64,
    pub brief_hash: [u8; 32],
    pub total_budget: u64,
    pub allocated_budget: u64,
    pub status: TaskStatus,
    pub orchestrator: Option<Pubkey>,
    pub created_at: i64,
    pub timeout_slots: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct SubtaskAccount {
    pub task: Pubkey,
    pub subtask_index: u32,
    pub parent_subtask: Option<Pubkey>,
    pub worker: Option<Pubkey>,
    pub allocated_budget: u64,
    pub spent_retry_budget: u64,
    pub max_retry_spend: u64,
    pub declared_tier: Option<Tier>,
    pub result_hash: Option<[u8; 32]>,
    pub status: SubtaskStatus,
    pub timeout_slot: u64,
    pub retry_count: u8,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum TaskStatus {
    Pending,
    Active,
    Completed,
    Disputed,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum SubtaskStatus {
    Allocated,
    TierDeclared,
    ResultSubmitted,
    Retried,
    Completed,
    TimedOut,
    Disputed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Tier {
    Simple,
    Medium,
    Complex,
}

#[event]
pub struct TaskCreated {
    pub task: Pubkey,
    pub creator: Pubkey,
    pub task_id: u64,
    pub budget: u64,
    pub timeout_slots: u64,
}

#[event]
pub struct OrchestratorAssigned {
    pub task: Pubkey,
    pub orchestrator: Pubkey,
}

#[event]
pub struct SubtaskAllocated {
    pub task: Pubkey,
    pub subtask: Pubkey,
    pub subtask_index: u32,
    pub parent_subtask: Option<Pubkey>,
    pub budget: u64,
    pub max_retry_spend: u64,
    pub timeout_slot: u64,
}

#[event]
pub struct TierDeclared {
    pub task: Pubkey,
    pub subtask: Pubkey,
    pub tier: Tier,
    pub worker: Pubkey,
}

#[event]
pub struct ResultSubmitted {
    pub task: Pubkey,
    pub subtask: Pubkey,
    pub worker: Pubkey,
    pub result_hash: [u8; 32],
}

#[event]
pub struct SubtaskCompleted {
    pub task: Pubkey,
    pub subtask: Pubkey,
    pub worker: Pubkey,
    pub amount: u64,
}

#[event]
pub struct SubtaskRetried {
    pub task: Pubkey,
    pub subtask: Pubkey,
    pub new_tier: Tier,
    pub new_worker: Pubkey,
    pub retry_spend: u64,
    pub spent_retry_budget: u64,
}

#[event]
pub struct TimeoutClaimed {
    pub task: Pubkey,
    pub subtask: Pubkey,
    pub claimant: Pubkey,
    pub slot: u64,
}

#[error_code]
pub enum TaskEscrowError {
    #[msg("Budget must be greater than zero")]
    InvalidBudget,
    #[msg("Timeout must be greater than zero")]
    InvalidTimeout,
    #[msg("Only the task creator can perform this action")]
    UnauthorizedCreator,
    #[msg("Only the assigned orchestrator can perform this action")]
    UnauthorizedOrchestrator,
    #[msg("Task status does not allow this operation")]
    InvalidTaskStatus,
    #[msg("Subtask status does not allow this operation")]
    InvalidSubtaskStatus,
    #[msg("Allocated budget exceeds task total budget")]
    BudgetExceeded,
    #[msg("Retry budget cannot exceed subtask allocation")]
    RetryBudgetExceedsAllocation,
    #[msg("Retry spend exceeds max_retry_spend")]
    RetryBudgetExceeded,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Subtask does not belong to task")]
    TaskMismatch,
    #[msg("Worker is not assigned")]
    WorkerNotAssigned,
    #[msg("Only the assigned worker can submit this result")]
    UnauthorizedWorker,
    #[msg("Worker account does not match assigned worker")]
    InvalidWorkerAccount,
    #[msg("Subtask result hash is missing")]
    MissingResult,
    #[msg("Invalid consensus authority PDA")]
    InvalidConsensusAuthority,
    #[msg("Consensus authority did not sign")]
    MissingConsensusSignature,
    #[msg("Task vault has insufficient lamports")]
    VaultInsufficientFunds,
    #[msg("Timeout slot has not been reached")]
    TimeoutNotReached,
    #[msg("A result has already been submitted")]
    ResultAlreadySubmitted,
}
