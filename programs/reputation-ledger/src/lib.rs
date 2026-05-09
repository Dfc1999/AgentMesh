#![deny(clippy::all)]

use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

pub const REPUTATION_SEED: &[u8] = b"rep";
pub const MAX_OUTCOMES: usize = 100;
pub const MIN_SCORE: i16 = -100;
pub const MAX_SCORE: i16 = 100;

#[program]
pub mod reputation_ledger {
    use super::*;

    pub fn record_outcome(
        ctx: Context<RecordOutcome>,
        task: Pubkey,
        success: bool,
        score: u8,
        tier_used: Tier,
    ) -> Result<()> {
        require!(score <= 100, ReputationLedgerError::InvalidScore);

        let ledger = &mut ctx.accounts.reputation;
        ledger.initialize_if_needed(ctx.accounts.agent.key(), ctx.bumps.reputation)?;

        let entry = OutcomeEntry {
            task,
            score,
            success,
            tier_used,
            recorded_at: Clock::get()?.unix_timestamp,
            sequence: ledger.total_outcomes,
        };

        ledger.push_outcome(entry)?;
        ledger.reputation_score = calculate_weighted_score(&ledger.outcomes);

        emit!(OutcomeRecorded {
            agent: ledger.agent,
            task,
            success,
            score,
            tier_used,
            reputation_score: ledger.reputation_score,
            sequence: entry.sequence,
        });

        Ok(())
    }

    pub fn record_tier_accuracy(
        ctx: Context<RecordTierAccuracy>,
        predicted_tier: Tier,
        actual_tier_needed: Tier,
        retry_happened: bool,
    ) -> Result<()> {
        let ledger = &mut ctx.accounts.reputation;
        ledger.initialize_if_needed(ctx.accounts.router_agent.key(), ctx.bumps.reputation)?;

        let was_accurate = predicted_tier == actual_tier_needed && !retry_happened;
        ledger.total_tier_predictions = ledger.total_tier_predictions.saturating_add(1);
        if was_accurate {
            ledger.accurate_tier_predictions = ledger.accurate_tier_predictions.saturating_add(1);
        }

        emit!(TierAccuracyRecorded {
            router_agent: ledger.agent,
            predicted_tier,
            actual_tier_needed,
            retry_happened,
            was_accurate,
            total_predictions: ledger.total_tier_predictions,
            accurate_predictions: ledger.accurate_tier_predictions,
        });

        Ok(())
    }

    pub fn query_score(ctx: Context<QueryScore>) -> Result<i16> {
        Ok(ctx.accounts.reputation.reputation_score)
    }

    pub fn export_credential(ctx: Context<QueryScore>) -> Result<ReputationCredential> {
        let ledger = &ctx.accounts.reputation;

        Ok(ReputationCredential {
            agent: ledger.agent,
            reputation_score: ledger.reputation_score,
            total_outcomes: ledger.total_outcomes,
            successful_outcomes: ledger.successful_outcomes,
            total_tier_predictions: ledger.total_tier_predictions,
            accurate_tier_predictions: ledger.accurate_tier_predictions,
            exported_at: Clock::get()?.unix_timestamp,
        })
    }
}

#[derive(Accounts)]
pub struct RecordOutcome<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = ReputationAccount::SPACE,
        seeds = [REPUTATION_SEED, agent.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, ReputationAccount>,
    /// CHECK: Agent identity can be any registered agent pubkey; registry validation is done by caller.
    pub agent: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordTierAccuracy<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        space = ReputationAccount::SPACE,
        seeds = [REPUTATION_SEED, router_agent.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, ReputationAccount>,
    /// CHECK: Router agent identity can be any registered agent pubkey; registry validation is done by caller.
    pub router_agent: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct QueryScore<'info> {
    #[account(seeds = [REPUTATION_SEED, reputation.agent.as_ref()], bump = reputation.bump)]
    pub reputation: Account<'info, ReputationAccount>,
}

#[account]
pub struct ReputationAccount {
    pub agent: Pubkey,
    pub reputation_score: i16,
    pub total_outcomes: u32,
    pub successful_outcomes: u32,
    pub total_tier_predictions: u32,
    pub accurate_tier_predictions: u32,
    pub outcomes: Vec<OutcomeEntry>,
    pub bump: u8,
}

impl ReputationAccount {
    pub const SPACE: usize =
        8 + 32 + 2 + 4 + 4 + 4 + 4 + 4 + (MAX_OUTCOMES * OutcomeEntry::SPACE) + 1;

    pub fn initialize_if_needed(&mut self, agent: Pubkey, bump: u8) -> Result<()> {
        if self.agent == Pubkey::default() {
            self.agent = agent;
            self.reputation_score = 0;
            self.total_outcomes = 0;
            self.successful_outcomes = 0;
            self.total_tier_predictions = 0;
            self.accurate_tier_predictions = 0;
            self.outcomes = Vec::new();
            self.bump = bump;
        }

        require_keys_eq!(self.agent, agent, ReputationLedgerError::AgentMismatch);

        Ok(())
    }

    pub fn push_outcome(&mut self, entry: OutcomeEntry) -> Result<()> {
        if self.outcomes.len() == MAX_OUTCOMES {
            self.outcomes.remove(0);
        }

        if entry.success {
            self.successful_outcomes = self.successful_outcomes.saturating_add(1);
        }
        self.total_outcomes = self.total_outcomes.saturating_add(1);
        self.outcomes.push(entry);

        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct OutcomeEntry {
    pub task: Pubkey,
    pub score: u8,
    pub success: bool,
    pub tier_used: Tier,
    pub recorded_at: i64,
    pub sequence: u32,
}

impl OutcomeEntry {
    pub const SPACE: usize = 32 + 1 + 1 + 1 + 8 + 4;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tier {
    Simple,
    Medium,
    Complex,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct ReputationCredential {
    pub agent: Pubkey,
    pub reputation_score: i16,
    pub total_outcomes: u32,
    pub successful_outcomes: u32,
    pub total_tier_predictions: u32,
    pub accurate_tier_predictions: u32,
    pub exported_at: i64,
}

#[event]
pub struct OutcomeRecorded {
    pub agent: Pubkey,
    pub task: Pubkey,
    pub success: bool,
    pub score: u8,
    pub tier_used: Tier,
    pub reputation_score: i16,
    pub sequence: u32,
}

#[event]
pub struct TierAccuracyRecorded {
    pub router_agent: Pubkey,
    pub predicted_tier: Tier,
    pub actual_tier_needed: Tier,
    pub retry_happened: bool,
    pub was_accurate: bool,
    pub total_predictions: u32,
    pub accurate_predictions: u32,
}

#[error_code]
pub enum ReputationLedgerError {
    #[msg("Scores must be between 0 and 100")]
    InvalidScore,
    #[msg("The reputation account does not belong to this agent")]
    AgentMismatch,
}

fn calculate_weighted_score(outcomes: &[OutcomeEntry]) -> i16 {
    if outcomes.is_empty() {
        return 0;
    }

    let mut weighted_sum: i64 = 0;
    let mut weight_sum: i64 = 0;

    for (index, outcome) in outcomes.iter().enumerate() {
        let recency_weight = if index >= outcomes.len().saturating_sub(20) {
            2
        } else {
            1
        };
        let signed_score = if outcome.success {
            i64::from(outcome.score)
        } else {
            -i64::from(100_u8.saturating_sub(outcome.score))
        };

        weighted_sum += signed_score * recency_weight;
        weight_sum += recency_weight;
    }

    let raw_score = weighted_sum / weight_sum;
    raw_score.clamp(i64::from(MIN_SCORE), i64::from(MAX_SCORE)) as i16
}

#[cfg(test)]
mod tests {
    use super::*;

    fn outcome(sequence: u32, success: bool, score: u8) -> OutcomeEntry {
        OutcomeEntry {
            task: Pubkey::new_unique(),
            score,
            success,
            tier_used: Tier::Simple,
            recorded_at: i64::from(sequence),
            sequence,
        }
    }

    #[test]
    fn new_agent_score_is_zero() {
        assert_eq!(calculate_weighted_score(&[]), 0);
    }

    #[test]
    fn successful_outcomes_raise_score() {
        let outcomes = vec![outcome(0, true, 80), outcome(1, true, 100)];
        assert_eq!(calculate_weighted_score(&outcomes), 90);
    }

    #[test]
    fn failed_outcomes_lower_score() {
        let outcomes = vec![outcome(0, false, 20), outcome(1, false, 10)];
        assert_eq!(calculate_weighted_score(&outcomes), -85);
    }

    #[test]
    fn recent_outcomes_have_double_weight() {
        let mut outcomes = Vec::new();
        for sequence in 0..80 {
            outcomes.push(outcome(sequence, false, 0));
        }
        for sequence in 80..100 {
            outcomes.push(outcome(sequence, true, 100));
        }

        assert_eq!(calculate_weighted_score(&outcomes), -33);
    }

    #[test]
    fn circular_buffer_keeps_latest_hundred_outcomes() {
        let mut reputation = ReputationAccount {
            agent: Pubkey::new_unique(),
            reputation_score: 0,
            total_outcomes: 0,
            successful_outcomes: 0,
            total_tier_predictions: 0,
            accurate_tier_predictions: 0,
            outcomes: Vec::new(),
            bump: 255,
        };

        for sequence in 0..105 {
            reputation
                .push_outcome(outcome(sequence, true, 100))
                .unwrap();
        }

        assert_eq!(reputation.outcomes.len(), MAX_OUTCOMES);
        assert_eq!(reputation.outcomes.first().unwrap().sequence, 5);
        assert_eq!(reputation.outcomes.last().unwrap().sequence, 104);
    }
}
