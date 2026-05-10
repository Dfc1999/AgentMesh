#![deny(clippy::all)]

use anchor_lang::prelude::*;

declare_id!("11111111111111111111111111111111");

pub const AGENT_SEED: &[u8] = b"agent";
pub const CONSENSUS_SLASH_AUTHORITY_SEED: &[u8] = b"slash_authority";
pub const MIN_REPUTATION_SCORE: i16 = -100;
pub const MAX_REPUTATION_SCORE: i16 = 100;
pub const RECRUITMENT_REPUTATION_THRESHOLD: i16 = -50;

#[program]
pub mod agent_registry {
    use super::*;

    pub fn register_agent(ctx: Context<RegisterAgent>, params: RegisterAgentParams) -> Result<()> {
        validate_capabilities(params.agent_class, params.capabilities)?;
        validate_supported_tiers(params.agent_class, params.supported_tiers)?;
        validate_routing_rules(&params.routing_rules)?;

        let agent = &mut ctx.accounts.agent;
        let now = Clock::get()?.unix_timestamp;

        agent.owner = ctx.accounts.owner.key();
        agent.capabilities = params.capabilities;
        agent.supported_tiers = params.supported_tiers;
        agent.price_per_task = params.price_per_task;
        agent.reputation_score = 0;
        agent.total_tasks = 0;
        agent.successful_tasks = 0;
        agent.routing_rules = params.routing_rules;
        agent.agent_class = params.agent_class;
        agent.is_active = true;
        agent.registered_at = now;
        agent.bump = ctx.bumps.agent;

        emit!(AgentRegistered {
            agent: agent.key(),
            owner: agent.owner,
            class: agent.agent_class,
            capabilities: agent.capabilities,
        });

        Ok(())
    }

    pub fn update_capabilities(ctx: Context<ManageAgent>, new_capabilities: u64) -> Result<()> {
        validate_capabilities(ctx.accounts.agent.agent_class, new_capabilities)?;

        let agent = &mut ctx.accounts.agent;
        agent.capabilities = new_capabilities;

        emit!(AgentCapabilitiesUpdated {
            agent: agent.key(),
            owner: agent.owner,
            capabilities: agent.capabilities,
        });

        Ok(())
    }

    pub fn set_routing_rules(ctx: Context<ManageAgent>, rules: RoutingRules) -> Result<()> {
        validate_routing_rules(&rules)?;

        let agent = &mut ctx.accounts.agent;
        agent.routing_rules = rules;

        emit!(AgentRoutingRulesUpdated {
            agent: agent.key(),
            owner: agent.owner,
            routing_rules: agent.routing_rules,
        });

        Ok(())
    }

    pub fn deactivate_agent(ctx: Context<ManageAgent>) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        agent.is_active = false;

        emit!(AgentDeactivated {
            agent: agent.key(),
            owner: agent.owner,
        });

        Ok(())
    }

    pub fn slash_reputation(
        ctx: Context<SlashReputation>,
        amount: i16,
        reason: SlashReason,
    ) -> Result<()> {
        require!(amount > 0, AgentRegistryError::InvalidSlashAmount);

        let expected_authority = Pubkey::find_program_address(
            &[CONSENSUS_SLASH_AUTHORITY_SEED],
            &ctx.accounts.consensus_program.key(),
        )
        .0;
        require_keys_eq!(
            ctx.accounts.consensus_slash_authority.key(),
            expected_authority,
            AgentRegistryError::UnauthorizedSlash
        );

        let agent = &mut ctx.accounts.agent;
        let previous_score = agent.reputation_score;
        agent.reputation_score = agent
            .reputation_score
            .saturating_sub(amount)
            .max(MIN_REPUTATION_SCORE);

        emit!(AgentReputationSlashed {
            agent: agent.key(),
            previous_score,
            new_score: agent.reputation_score,
            amount,
            reason,
        });

        Ok(())
    }

    pub fn get_agents_by_capability(
        ctx: Context<GetAgentsByCapability>,
        capability_mask: u64,
    ) -> Result<Vec<Pubkey>> {
        let mut matching_agents = Vec::new();

        for account_info in ctx.remaining_accounts {
            if account_info.owner != &crate::ID {
                continue;
            }

            let data = account_info.try_borrow_data()?;
            let mut account_data: &[u8] = &data;
            let agent = AgentAccount::try_deserialize(&mut account_data)?;

            let has_capabilities = agent.capabilities & capability_mask == capability_mask;
            if has_capabilities
                && agent.is_active
                && agent.reputation_score >= RECRUITMENT_REPUTATION_THRESHOLD
            {
                matching_agents.push(*account_info.key);
            }
        }

        Ok(matching_agents)
    }
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = owner,
        space = AgentAccount::SPACE,
        seeds = [AGENT_SEED, owner.key().as_ref()],
        bump
    )]
    pub agent: Account<'info, AgentAccount>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageAgent<'info> {
    #[account(
        mut,
        seeds = [AGENT_SEED, owner.key().as_ref()],
        bump = agent.bump,
        has_one = owner @ AgentRegistryError::UnauthorizedOwner
    )]
    pub agent: Account<'info, AgentAccount>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SlashReputation<'info> {
    #[account(mut)]
    pub agent: Account<'info, AgentAccount>,
    /// CHECK: Only used as the program id that owns the slash-authority PDA.
    pub consensus_program: UncheckedAccount<'info>,
    pub consensus_slash_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct GetAgentsByCapability {}

#[account]
pub struct AgentAccount {
    pub owner: Pubkey,
    pub capabilities: u64,
    pub supported_tiers: u8,
    pub price_per_task: u64,
    pub reputation_score: i16,
    pub total_tasks: u32,
    pub successful_tasks: u32,
    pub routing_rules: RoutingRules,
    pub agent_class: AgentClass,
    pub is_active: bool,
    pub registered_at: i64,
    pub bump: u8,
}

impl AgentAccount {
    pub const SPACE: usize = 8 + 32 + 8 + 1 + 8 + 2 + 4 + 4 + RoutingRules::SPACE + 1 + 1 + 8 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct RoutingRules {
    pub simple_max_tokens: u32,
    pub simple_max_complexity_bps: u16,
    pub medium_max_tokens: u32,
    pub medium_max_complexity_bps: u16,
    pub min_reputation_score: i16,
    pub max_retries: u8,
}

impl RoutingRules {
    pub const SPACE: usize = 4 + 2 + 4 + 2 + 2 + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct RegisterAgentParams {
    pub capabilities: u64,
    pub supported_tiers: u8,
    pub price_per_task: u64,
    pub routing_rules: RoutingRules,
    pub agent_class: AgentClass,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum AgentClass {
    Worker,
    Router,
    Judge,
    Optimizer,
    Validator,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SlashReason {
    InvalidValidation,
    MissedDeadline,
    FraudulentResult,
    DisputeVetoed,
    ManualReview,
}

pub struct CapabilityBitmap;

impl CapabilityBitmap {
    pub const RESEARCH: u64 = 1 << 0;
    pub const ANALYSIS: u64 = 1 << 1;
    pub const EXECUTION: u64 = 1 << 2;
    pub const VALIDATION: u64 = 1 << 3;
    pub const ROUTING: u64 = 1 << 4;
    pub const JUDGING: u64 = 1 << 5;
    pub const OPTIMIZATION: u64 = 1 << 6;
    pub const ORCHESTRATION: u64 = 1 << 7;
    pub const ALL: u64 = Self::RESEARCH
        | Self::ANALYSIS
        | Self::EXECUTION
        | Self::VALIDATION
        | Self::ROUTING
        | Self::JUDGING
        | Self::OPTIMIZATION
        | Self::ORCHESTRATION;
}

pub struct TierBitmap;

impl TierBitmap {
    pub const SIMPLE: u8 = 0b001;
    pub const MEDIUM: u8 = 0b010;
    pub const COMPLEX: u8 = 0b100;
    pub const ALL: u8 = Self::SIMPLE | Self::MEDIUM | Self::COMPLEX;
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub class: AgentClass,
    pub capabilities: u64,
}

#[event]
pub struct AgentCapabilitiesUpdated {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub capabilities: u64,
}

#[event]
pub struct AgentRoutingRulesUpdated {
    pub agent: Pubkey,
    pub owner: Pubkey,
    pub routing_rules: RoutingRules,
}

#[event]
pub struct AgentDeactivated {
    pub agent: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct AgentReputationSlashed {
    pub agent: Pubkey,
    pub previous_score: i16,
    pub new_score: i16,
    pub amount: i16,
    pub reason: SlashReason,
}

#[error_code]
pub enum AgentRegistryError {
    #[msg("The requested agent PDA is already registered")]
    AgentAlreadyRegistered,
    #[msg("Only the registered owner can manage this agent")]
    UnauthorizedOwner,
    #[msg("Only the consensus slash authority can slash reputation")]
    UnauthorizedSlash,
    #[msg("The slash amount must be positive")]
    InvalidSlashAmount,
    #[msg("The capability bitmap is empty or contains unknown bits")]
    InvalidCapabilityBitmap,
    #[msg("The capability bitmap is inconsistent with the agent class")]
    CapabilityClassMismatch,
    #[msg("Supported tiers must use simple, medium, or complex tier bits")]
    InvalidSupportedTiers,
    #[msg("Routing rules must be monotonic and use basis points from 0 to 10000")]
    InvalidRoutingRules,
}

fn validate_capabilities(agent_class: AgentClass, capabilities: u64) -> Result<()> {
    require!(
        capabilities != 0 && capabilities & !CapabilityBitmap::ALL == 0,
        AgentRegistryError::InvalidCapabilityBitmap
    );

    let required = match agent_class {
        AgentClass::Worker => {
            CapabilityBitmap::RESEARCH
                | CapabilityBitmap::ANALYSIS
                | CapabilityBitmap::EXECUTION
                | CapabilityBitmap::ORCHESTRATION
        }
        AgentClass::Router => CapabilityBitmap::ROUTING,
        AgentClass::Judge => CapabilityBitmap::JUDGING,
        AgentClass::Optimizer => CapabilityBitmap::OPTIMIZATION,
        AgentClass::Validator => CapabilityBitmap::VALIDATION,
    };

    require!(
        capabilities & required != 0,
        AgentRegistryError::CapabilityClassMismatch
    );

    Ok(())
}

fn validate_supported_tiers(agent_class: AgentClass, supported_tiers: u8) -> Result<()> {
    if agent_class == AgentClass::Worker {
        require!(
            supported_tiers != 0 && supported_tiers & !TierBitmap::ALL == 0,
            AgentRegistryError::InvalidSupportedTiers
        );
    }

    Ok(())
}

fn validate_routing_rules(rules: &RoutingRules) -> Result<()> {
    let complexity_is_valid = rules.simple_max_complexity_bps <= 10_000
        && rules.medium_max_complexity_bps <= 10_000
        && rules.simple_max_complexity_bps <= rules.medium_max_complexity_bps;
    let token_bounds_are_valid =
        rules.simple_max_tokens > 0 && rules.simple_max_tokens <= rules.medium_max_tokens;

    require!(
        complexity_is_valid && token_bounds_are_valid,
        AgentRegistryError::InvalidRoutingRules
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_routing_rules() -> RoutingRules {
        RoutingRules {
            simple_max_tokens: 1_000,
            simple_max_complexity_bps: 2_500,
            medium_max_tokens: 4_000,
            medium_max_complexity_bps: 7_500,
            min_reputation_score: RECRUITMENT_REPUTATION_THRESHOLD,
            max_retries: 1,
        }
    }

    #[test]
    fn router_requires_routing_capability() {
        assert!(validate_capabilities(AgentClass::Router, CapabilityBitmap::ROUTING).is_ok());
        assert!(validate_capabilities(AgentClass::Router, CapabilityBitmap::JUDGING).is_err());
    }

    #[test]
    fn worker_requires_valid_tier_bitmap() {
        assert!(validate_supported_tiers(AgentClass::Worker, TierBitmap::SIMPLE).is_ok());
        assert!(validate_supported_tiers(AgentClass::Worker, 0).is_err());
        assert!(validate_supported_tiers(AgentClass::Worker, 0b1000).is_err());
    }

    #[test]
    fn routing_rules_must_be_monotonic() {
        assert!(validate_routing_rules(&valid_routing_rules()).is_ok());

        let mut invalid_tokens = valid_routing_rules();
        invalid_tokens.simple_max_tokens = 5_000;
        assert!(validate_routing_rules(&invalid_tokens).is_err());

        let mut invalid_complexity = valid_routing_rules();
        invalid_complexity.simple_max_complexity_bps = 8_000;
        assert!(validate_routing_rules(&invalid_complexity).is_err());
    }
}
