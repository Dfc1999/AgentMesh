#![deny(clippy::all)]

use pinocchio::error::ProgramError;
use pinocchio::sysvars::{clock::Clock, Sysvar};
use pinocchio::{AccountView, Address, ProgramResult};

#[cfg(feature = "bpf-entrypoint")]
use pinocchio::entrypoint;

#[cfg(feature = "bpf-entrypoint")]
entrypoint!(process_instruction);

pub const ID: Address = Address::new_from_array([0; 32]);
pub const REPUTATION_SEED: &[u8] = b"rep";
pub const DISCRIMINATOR_REPUTATION: u8 = 1;
pub const ACCOUNT_VERSION: u8 = 1;
pub const MAX_OUTCOMES: usize = 100;

const IX_INITIALIZE_REPUTATION: u8 = 0;
const IX_RECORD_OUTCOME: u8 = 1;
const IX_RECORD_TIER_ACCURACY: u8 = 2;
const IX_QUERY_SCORE: u8 = 3;
const IX_EXPORT_CREDENTIAL: u8 = 4;

const HEADER_LEN: usize = 71;
const OUTCOME_LEN: usize = 52;
pub const REPUTATION_ACCOUNT_LEN: usize = HEADER_LEN + (MAX_OUTCOMES * OUTCOME_LEN);

const OFFSET_DISCRIMINATOR: usize = 0;
const OFFSET_VERSION: usize = 1;
const OFFSET_AGENT: usize = 2;
const OFFSET_CURRENT_SCORE: usize = 34;
const OFFSET_TOTAL_OUTCOMES: usize = 36;
const OFFSET_SUCCESSFUL_OUTCOMES: usize = 44;
const OFFSET_FAILED_OUTCOMES: usize = 48;
const OFFSET_BUFFER_CURSOR: usize = 52;
const OFFSET_ENTRY_COUNT: usize = 53;
const OFFSET_TIER_CHECKS: usize = 54;
const OFFSET_TIER_CORRECT: usize = 58;
const OFFSET_TIER_RETRIES: usize = 62;
const OFFSET_CREDENTIAL_EXPORTS: usize = 66;
const OFFSET_BUMP: usize = 70;
const OFFSET_OUTCOMES: usize = HEADER_LEN;

pub fn process_instruction(
    program_id: &Address,
    accounts: &mut [AccountView],
    instruction_data: &[u8],
) -> ProgramResult {
    let Some((instruction, data)) = instruction_data.split_first() else {
        return Err(ProgramError::InvalidInstructionData);
    };

    match *instruction {
        IX_INITIALIZE_REPUTATION => initialize_reputation(program_id, accounts, data),
        IX_RECORD_OUTCOME => record_outcome(program_id, accounts, data),
        IX_RECORD_TIER_ACCURACY => record_tier_accuracy(program_id, accounts, data),
        IX_QUERY_SCORE => query_score(program_id, accounts),
        IX_EXPORT_CREDENTIAL => export_credential(program_id, accounts),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn initialize_reputation(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    require_data_len(data, 1)?;
    require_accounts_len(accounts, 3)?;

    let payer = &accounts[0];
    let agent = &accounts[1];
    let mut reputation = accounts[2];
    let bump = data[0];

    require_signer(payer)?;
    require_writable(&reputation)?;
    validate_reputation_pda(program_id, agent, &reputation, bump)?;

    // The account allocation/funding is intentionally left to the client or
    // future ISSUE-02-07 helpers. Pinocchio keeps this program framework-light;
    // this instruction initializes an already-created PDA account.
    let mut account_data = reputation.try_borrow_mut()?;
    require_account_len(&account_data, REPUTATION_ACCOUNT_LEN)?;
    account_data.fill(0);
    account_data[OFFSET_DISCRIMINATOR] = DISCRIMINATOR_REPUTATION;
    account_data[OFFSET_VERSION] = ACCOUNT_VERSION;
    account_data[OFFSET_AGENT..OFFSET_AGENT + 32].copy_from_slice(agent.address().as_ref());
    write_u8(&mut account_data, OFFSET_BUMP, bump);

    Ok(())
}

fn record_outcome(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    require_data_len(data, 36)?;
    require_accounts_len(accounts, 3)?;

    let authority = &accounts[0];
    let agent = &accounts[1];
    let mut reputation = accounts[2];

    require_signer(authority)?;
    require_writable(&reputation)?;
    validate_reputation_account_address(program_id, agent, &reputation)?;

    let task = read_pubkey(data, 0)?;
    let success = read_bool(data, 32)?;
    let score = read_i16(data, 33)?;
    let tier_used = read_tier(data, 35)?;
    if !(-100..=100).contains(&score) {
        return Err(ReputationError::InvalidScore.into());
    }

    let clock = Clock::get()?;
    let mut account_data = reputation.try_borrow_mut()?;
    validate_reputation_account(&account_data, agent.address())?;

    let entry_count = read_u8(&account_data, OFFSET_ENTRY_COUNT)? as usize;
    if entry_count >= MAX_OUTCOMES {
        return Err(ReputationError::OutcomeBufferFull.into());
    }

    let total_outcomes = read_u64(&account_data, OFFSET_TOTAL_OUTCOMES)?;
    let outcome_offset = OFFSET_OUTCOMES + (entry_count * OUTCOME_LEN);
    write_outcome(
        &mut account_data,
        outcome_offset,
        OutcomeView {
            sequence: total_outcomes,
            task,
            success,
            score,
            tier_used,
            recorded_at: clock.unix_timestamp,
        },
    )?;

    write_u8(&mut account_data, OFFSET_ENTRY_COUNT, (entry_count + 1) as u8);
    write_u8(
        &mut account_data,
        OFFSET_BUFFER_CURSOR,
        ((entry_count + 1) % MAX_OUTCOMES) as u8,
    );
    write_u64(&mut account_data, OFFSET_TOTAL_OUTCOMES, checked_inc_u64(total_outcomes)?)?;

    if success {
        let successes = read_u32(&account_data, OFFSET_SUCCESSFUL_OUTCOMES)?;
        write_u32(&mut account_data, OFFSET_SUCCESSFUL_OUTCOMES, checked_inc_u32(successes)?)?;
    } else {
        let failures = read_u32(&account_data, OFFSET_FAILED_OUTCOMES)?;
        write_u32(&mut account_data, OFFSET_FAILED_OUTCOMES, checked_inc_u32(failures)?)?;
    }

    let current_score = calculate_weighted_score_from_account(&account_data)?;
    write_i16(&mut account_data, OFFSET_CURRENT_SCORE, current_score)?;

    Ok(())
}

fn record_tier_accuracy(
    program_id: &Address,
    accounts: &mut [AccountView],
    data: &[u8],
) -> ProgramResult {
    require_data_len(data, 3)?;
    require_accounts_len(accounts, 3)?;

    let authority = &accounts[0];
    let router_agent = &accounts[1];
    let mut reputation = accounts[2];

    require_signer(authority)?;
    require_writable(&reputation)?;
    validate_reputation_account_address(program_id, router_agent, &reputation)?;

    let predicted_tier = read_tier(data, 0)?;
    let actual_tier_needed = read_tier(data, 1)?;
    let retry_happened = read_bool(data, 2)?;

    let mut account_data = reputation.try_borrow_mut()?;
    validate_reputation_account(&account_data, router_agent.address())?;

    let tier_checks = read_u32(&account_data, OFFSET_TIER_CHECKS)?;
    write_u32(&mut account_data, OFFSET_TIER_CHECKS, checked_inc_u32(tier_checks)?)?;

    if predicted_tier == actual_tier_needed && !retry_happened {
        let tier_correct = read_u32(&account_data, OFFSET_TIER_CORRECT)?;
        write_u32(&mut account_data, OFFSET_TIER_CORRECT, checked_inc_u32(tier_correct)?)?;
    }

    if retry_happened {
        let tier_retries = read_u32(&account_data, OFFSET_TIER_RETRIES)?;
        write_u32(&mut account_data, OFFSET_TIER_RETRIES, checked_inc_u32(tier_retries)?)?;
    }

    Ok(())
}

fn query_score(program_id: &Address, accounts: &mut [AccountView]) -> ProgramResult {
    require_accounts_len(accounts, 2)?;
    let agent = &accounts[0];
    let reputation = &accounts[1];
    validate_reputation_account_address(program_id, agent, reputation)?;

    let account_data = reputation.try_borrow()?;
    validate_reputation_account(&account_data, agent.address())?;

    // Pinocchio has no Anchor-style return channel. The current score is kept in
    // account data at OFFSET_CURRENT_SCORE for clients to read directly.
    let _score = read_i16(&account_data, OFFSET_CURRENT_SCORE)?;
    Ok(())
}

fn export_credential(program_id: &Address, accounts: &mut [AccountView]) -> ProgramResult {
    require_accounts_len(accounts, 3)?;
    let authority = &accounts[0];
    let agent = &accounts[1];
    let mut reputation = accounts[2];

    require_signer(authority)?;
    require_writable(&reputation)?;
    validate_reputation_account_address(program_id, agent, &reputation)?;

    let mut account_data = reputation.try_borrow_mut()?;
    validate_reputation_account(&account_data, agent.address())?;
    let exports = read_u32(&account_data, OFFSET_CREDENTIAL_EXPORTS)?;
    write_u32(&mut account_data, OFFSET_CREDENTIAL_EXPORTS, checked_inc_u32(exports)?)?;

    Ok(())
}

fn validate_reputation_account_address(
    program_id: &Address,
    agent: &AccountView,
    reputation: &AccountView,
) -> ProgramResult {
    let data = reputation.try_borrow()?;
    require_account_len(&data, REPUTATION_ACCOUNT_LEN)?;
    let bump = read_u8(&data, OFFSET_BUMP)?;
    drop(data);
    validate_reputation_pda(program_id, agent, reputation, bump)
}

fn validate_reputation_pda(
    program_id: &Address,
    agent: &AccountView,
    reputation: &AccountView,
    bump: u8,
) -> ProgramResult {
    let expected = Address::derive_address(&[REPUTATION_SEED, agent.address().as_ref()], Some(bump), program_id);
    if reputation.address() != &expected {
        return Err(ProgramError::InvalidSeeds);
    }
    Ok(())
}

fn validate_reputation_account(data: &[u8], agent: &Address) -> ProgramResult {
    require_account_len(data, REPUTATION_ACCOUNT_LEN)?;
    if data[OFFSET_DISCRIMINATOR] != DISCRIMINATOR_REPUTATION {
        return Err(ProgramError::InvalidAccountData);
    }
    if data[OFFSET_VERSION] != ACCOUNT_VERSION {
        return Err(ProgramError::InvalidAccountData);
    }
    if &data[OFFSET_AGENT..OFFSET_AGENT + 32] != agent.as_ref() {
        return Err(ReputationError::AgentMismatch.into());
    }
    Ok(())
}

pub fn calculate_weighted_score_from_account(data: &[u8]) -> Result<i16, ProgramError> {
    let entry_count = read_u8(data, OFFSET_ENTRY_COUNT)? as usize;
    if entry_count == 0 {
        return Ok(0);
    }

    let newest_sequence = read_outcome_sequence(data, entry_count - 1)?;
    let recent_cutoff = newest_sequence.saturating_sub(50);
    let mut weighted_total: i64 = 0;
    let mut weight_sum: i64 = 0;

    for index in 0..entry_count {
        let offset = OFFSET_OUTCOMES + (index * OUTCOME_LEN);
        let sequence = read_u64(data, offset)?;
        let success = read_bool(data, offset + 40)?;
        let score = read_i16(data, offset + 41)?;
        let weight = if sequence >= recent_cutoff { 2 } else { 1 };
        let signed_score = if success { i64::from(score) } else { -i64::from(score.abs()) };
        weighted_total += signed_score * weight;
        weight_sum += weight;
    }

    Ok((weighted_total / weight_sum).clamp(-100, 100) as i16)
}

fn read_outcome_sequence(data: &[u8], index: usize) -> Result<u64, ProgramError> {
    read_u64(data, OFFSET_OUTCOMES + (index * OUTCOME_LEN))
}

struct OutcomeView {
    sequence: u64,
    task: [u8; 32],
    success: bool,
    score: i16,
    tier_used: Tier,
    recorded_at: i64,
}

fn write_outcome(data: &mut [u8], offset: usize, outcome: OutcomeView) -> ProgramResult {
    write_u64(data, offset, outcome.sequence)?;
    data[offset + 8..offset + 40].copy_from_slice(&outcome.task);
    write_bool(data, offset + 40, outcome.success)?;
    write_i16(data, offset + 41, outcome.score)?;
    write_tier(data, offset + 43, outcome.tier_used)?;
    write_i64(data, offset + 44, outcome.recorded_at)?;
    Ok(())
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tier {
    Simple = 0,
    Medium = 1,
    Complex = 2,
}

fn read_tier(data: &[u8], offset: usize) -> Result<Tier, ProgramError> {
    let value = read_u8(data, offset)?;
    match value {
        0 => Ok(Tier::Simple),
        1 => Ok(Tier::Medium),
        2 => Ok(Tier::Complex),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn write_tier(data: &mut [u8], offset: usize, tier: Tier) -> ProgramResult {
    write_u8(data, offset, tier as u8);
    Ok(())
}

fn require_accounts_len(accounts: &[AccountView], len: usize) -> ProgramResult {
    if accounts.len() < len {
        return Err(ProgramError::NotEnoughAccountKeys);
    }
    Ok(())
}

fn require_data_len(data: &[u8], len: usize) -> ProgramResult {
    if data.len() < len {
        return Err(ProgramError::InvalidInstructionData);
    }
    Ok(())
}

fn require_account_len(data: &[u8], len: usize) -> ProgramResult {
    if data.len() < len {
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(())
}

fn require_signer(account: &AccountView) -> ProgramResult {
    if !account.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(())
}

fn require_writable(account: &AccountView) -> ProgramResult {
    if !account.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(())
}

fn checked_inc_u32(value: u32) -> Result<u32, ProgramError> {
    value.checked_add(1).ok_or(ReputationError::ArithmeticOverflow.into())
}

fn checked_inc_u64(value: u64) -> Result<u64, ProgramError> {
    value.checked_add(1).ok_or(ReputationError::ArithmeticOverflow.into())
}

fn read_pubkey(data: &[u8], offset: usize) -> Result<[u8; 32], ProgramError> {
    require_data_len(data, offset + 32)?;
    let mut bytes = [0_u8; 32];
    bytes.copy_from_slice(&data[offset..offset + 32]);
    Ok(bytes)
}

fn read_bool(data: &[u8], offset: usize) -> Result<bool, ProgramError> {
    Ok(match read_u8(data, offset)? {
        0 => false,
        1 => true,
        _ => return Err(ProgramError::InvalidInstructionData),
    })
}

fn write_bool(data: &mut [u8], offset: usize, value: bool) -> ProgramResult {
    write_u8(data, offset, u8::from(value));
    Ok(())
}

fn read_u8(data: &[u8], offset: usize) -> Result<u8, ProgramError> {
    require_data_len(data, offset + 1)?;
    Ok(data[offset])
}

fn write_u8(data: &mut [u8], offset: usize, value: u8) {
    data[offset] = value;
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32, ProgramError> {
    require_data_len(data, offset + 4)?;
    Ok(u32::from_le_bytes(data[offset..offset + 4].try_into().map_err(|_| ProgramError::InvalidAccountData)?))
}

fn write_u32(data: &mut [u8], offset: usize, value: u32) -> ProgramResult {
    require_account_len(data, offset + 4)?;
    data[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64, ProgramError> {
    require_data_len(data, offset + 8)?;
    Ok(u64::from_le_bytes(data[offset..offset + 8].try_into().map_err(|_| ProgramError::InvalidAccountData)?))
}

fn write_u64(data: &mut [u8], offset: usize, value: u64) -> ProgramResult {
    require_account_len(data, offset + 8)?;
    data[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

fn read_i16(data: &[u8], offset: usize) -> Result<i16, ProgramError> {
    require_data_len(data, offset + 2)?;
    Ok(i16::from_le_bytes(data[offset..offset + 2].try_into().map_err(|_| ProgramError::InvalidAccountData)?))
}

fn write_i16(data: &mut [u8], offset: usize, value: i16) -> ProgramResult {
    require_account_len(data, offset + 2)?;
    data[offset..offset + 2].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

fn write_i64(data: &mut [u8], offset: usize, value: i64) -> ProgramResult {
    require_account_len(data, offset + 8)?;
    data[offset..offset + 8].copy_from_slice(&value.to_le_bytes());
    Ok(())
}

#[repr(u32)]
pub enum ReputationError {
    InvalidScore = 6000,
    AgentMismatch = 6001,
    ArithmeticOverflow = 6002,
    OutcomeBufferFull = 6003,
}

impl From<ReputationError> for ProgramError {
    fn from(error: ReputationError) -> Self {
        ProgramError::Custom(error as u32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn initialized_account() -> Vec<u8> {
        let mut data = vec![0_u8; REPUTATION_ACCOUNT_LEN];
        data[OFFSET_DISCRIMINATOR] = DISCRIMINATOR_REPUTATION;
        data[OFFSET_VERSION] = ACCOUNT_VERSION;
        data
    }

    #[test]
    fn score_zero_for_new_agent() {
        let data = initialized_account();
        assert_eq!(calculate_weighted_score_from_account(&data).unwrap(), 0);
    }
}
