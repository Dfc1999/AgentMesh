# EPIC-02 Issues 02-03 to 02-06

This document describes the on-chain implementation completed for:

- ISSUE-02-03: Task Escrow creation and hierarchical subtasks
- ISSUE-02-04: Task Escrow execution, retries, completion, and timeout lifecycle
- ISSUE-02-05: Consensus M-of-N validation and dispute/veto flow
- ISSUE-02-06: Reputation Ledger outcome tracking and scoring

The work intentionally avoids implementing ISSUE-02-01, ISSUE-02-02, and ISSUE-02-07. Agent Registry integration, final program-id pinning, IDL export packaging, and full TypeScript client helpers remain separate work.

## Important Scope Decisions

### Agent Registry Was Not Implemented

No Agent Registry state or instructions were added. Where the plan expects agent lookup, validator filtering, or slashing through Agent Registry, this implementation leaves explicit integration points:

- Consensus stores validator pubkeys directly in `ConsensusAccount`.
- Consensus prevents duplicate validators and prevents the worker from validating its own subtask.
- Slashing is not called yet. That belongs to Agent Registry work in ISSUE-02-02 and integration work in ISSUE-02-07.

### Reputation Ledger Uses Pinocchio

Following the architecture decision for this epic, Reputation Ledger was implemented with Pinocchio instead of Anchor. Task Escrow and Consensus remain Anchor programs because they benefit from Anchor account validation, CPI ergonomics, and IDL generation. Reputation Ledger is kept framework-light because its hot path is mostly fixed-layout account reads/writes and score calculation.

The Pinocchio program keeps a compact byte layout and instruction byte tags instead of Anchor-generated account structs and discriminators. Its public instruction surface matches the product API planned for ISSUE-02-06:

- `initialize_reputation`
- `record_outcome`
- `record_tier_accuracy`
- `query_score`
- `export_credential`

Important integration note: `initialize_reputation` initializes an already-created PDA account. It does not allocate/fund the account internally. The client helpers from ISSUE-02-07 should create the PDA with `REPUTATION_ACCOUNT_LEN` bytes, fund it as rent-exempt, and then call `initialize_reputation` with the bump.

### Consensus-to-Escrow Integration Is Prepared by CPI

Consensus calls `task_escrow::complete_subtask` by CPI when enough approvals are collected. Since the repository still uses placeholder program IDs, Task Escrow validates a consensus authority PDA derived from the supplied consensus program account:

```text
["consensus_authority", subtask_pubkey]
```

Final hardening should pin deployed program IDs once ISSUE-02-07 configures IDLs and clients.

## Files Changed

### Task Escrow

```text
programs/task-escrow/src/lib.rs
```

Implemented:

- `TaskAccount`
- `SubtaskAccount`
- `TaskStatus`
- `SubtaskStatus`
- `Tier`
- Task/subtask events
- Task/subtask errors
- All Task Escrow instructions for issues 02-03 and 02-04

### Consensus

```text
programs/consensus/src/lib.rs
programs/consensus/Cargo.toml
```

Implemented:

- `ConsensusAccount`
- `ValidatorSig`
- `ConsensusStatus`
- Consensus events
- Consensus errors
- Dependency on `task-escrow` with `cpi` feature
- M-of-N validation logic
- CPI to Task Escrow completion

### Reputation Ledger

```text
programs/reputation-ledger/src/lib.rs
programs/reputation-ledger/Cargo.toml
```

Implemented:

- Pinocchio `process_instruction` entrypoint
- fixed byte-layout `ReputationAccount`
- fixed byte-layout outcome entries
- `Tier`
- custom reputation errors
- fixed-size append-only retained window for 100 outcomes
- Weighted scoring helper with unit tests for pure scoring logic

## Task Escrow Details

### PDAs

```text
TaskAccount:
["task", creator_pubkey, task_id_le_bytes]

Task vault:
["task_vault", task_pubkey]

SubtaskAccount:
["subtask", task_pubkey, subtask_index_le_bytes]
```

### Accounts

`TaskAccount` stores:

- `creator`
- `task_id`
- `brief_hash`
- `total_budget`
- `allocated_budget`
- `status`
- `orchestrator`
- `created_at`
- `timeout_slots`
- `bump`

`SubtaskAccount` stores:

- `task`
- `subtask_index`
- `parent_subtask`
- `worker`
- `allocated_budget`
- `spent_retry_budget`
- `max_retry_spend`
- `declared_tier`
- `result_hash`
- `status`
- `timeout_slot`
- `retry_count`
- `bump`

### Instructions

#### `create_task(task_id, brief_hash, budget, timeout_slots)`

Creates `TaskAccount`, creates a program-owned task vault PDA, and transfers the task budget from creator to the vault.

Validation:

- `budget > 0`
- `timeout_slots > 0`

Emits:

- `TaskCreated`

#### `assign_orchestrator(orchestrator_pubkey)`

Assigns the off-chain orchestrator authority for future subtask allocation.

Validation:

- signer must be task creator
- task must be `Pending` or `Active`

Emits:

- `OrchestratorAssigned`

#### `allocate_subtask(subtask_index, parent_subtask, budget, max_retry_spend, timeout_slot)`

Creates a `SubtaskAccount` under a task.

Validation:

- if no orchestrator is assigned, signer must be creator
- if orchestrator is assigned, signer must be orchestrator
- `budget > 0`
- `max_retry_spend <= budget`
- task allocated budget cannot exceed total task budget

Emits:

- `SubtaskAllocated`

#### `declare_tier(tier, worker)`

Sets the tier and worker before execution.

Current status allowed:

- `Allocated`
- `Retried`

Emits:

- `TierDeclared`

#### `submit_result(result_hash)`

Worker submits a SHA-256 content hash.

Validation:

- signer must match assigned worker
- status must be `TierDeclared` or `Retried`

Emits:

- `ResultSubmitted`

#### `complete_subtask(consensus_authority_bump)`

Transfers the allocated budget from task vault to worker and marks subtask complete.

Validation:

- status must be `ResultSubmitted`
- result hash must exist
- worker account must match assigned worker
- consensus authority PDA must sign

Emits:

- `SubtaskCompleted`

#### `retry_subtask(new_tier, new_worker, retry_spend)`

Resets result, assigns a new tier/worker, and tracks retry spend.

Validation:

- status must be `ResultSubmitted` or `TierDeclared`
- cumulative retry spend cannot exceed `max_retry_spend`

Emits:

- `SubtaskRetried`

#### `claim_timeout_refund()`

Marks a subtask as timed out and clears worker/tier so it can be re-auctioned later.

Validation:

- current slot must be greater than `timeout_slot`
- subtask must not be completed
- no result hash can already exist

Emits:

- `TimeoutClaimed`

Note: this does not transfer lamports back to creator yet. It prepares the subtask for re-auction. Refund/cancel semantics should be finalized in integration work.

## Consensus Details

### PDAs

```text
ConsensusAccount:
["consensus", subtask_pubkey]

Consensus authority:
["consensus_authority", subtask_pubkey]
```

### Accounts

`ConsensusAccount` stores:

- `subtask`
- `task`
- `creator`
- `worker`
- `required_signatures`
- `total_validators`
- `validators`
- `signatures`
- `status`
- `dispute_deadline_slot`
- `bump`
- `authority_bump`

Validator and signature lists are capped at 5 validators for MVP coverage of 2-of-3 and 3-of-5 flows.

### Instructions

#### `initialize_consensus(required_signatures, validators, dispute_deadline_slot)`

Creates a consensus account for a subtask.

Validation:

- subtask belongs to task
- subtask status is `ResultSubmitted`
- validator count is between 1 and 5
- required signatures are between 1 and validator count
- validators are distinct
- worker is not included as validator

Emits:

- `ConsensusInitialized`

#### `submit_validation(approved, justification_hash)`

Stores a validator signature. When approvals reach `required_signatures`, Consensus performs CPI into Task Escrow `complete_subtask`.

Validation:

- consensus status must be `Pending`
- validator must be in validator set
- validator cannot be worker
- validator cannot sign twice
- consensus program account must match current program id

Emits:

- `ValidationSubmitted`
- `ConsensusApproved` if threshold is met

#### `dispute_result()`

Allows task creator to mark consensus disputed during the grace window.

Validation:

- signer must be creator
- current slot must be <= `dispute_deadline_slot`
- status must be `Pending` or `Approved`

Emits:

- `ConsensusDisputed`

#### `veto_result()`

Allows task creator to veto during the grace window.

Validation:

- signer must be creator
- current slot must be <= `dispute_deadline_slot`

Emits:

- `ConsensusVetoed`

### Pending Agent Registry Integration

The plan asks for CPI to `agent_registry::slash_reputation` when a validator approves later-refuted work. This implementation does not call Agent Registry yet because issues 02-01 and 02-02 are intentionally out of scope.

Recommended integration point:

- Add a `slash_validator` or dispute-finalization instruction after Agent Registry exposes `slash_reputation`.
- Validate the Agent Registry program id explicitly.
- Emit a final dispute outcome event before calling slash CPI.

## Reputation Ledger Details

### PDA

```text
ReputationAccount:
["rep", agent_pubkey]
```

### Account

`ReputationAccount` is a fixed-layout Pinocchio account with `REPUTATION_ACCOUNT_LEN = 5271` bytes:

- `agent`
- `current_score`
- `total_outcomes`
- `successful_outcomes`
- `failed_outcomes`
- `buffer_cursor`
- `entry_count`
- `outcomes`
- `tier_checks`
- `tier_correct`
- `tier_retries`
- `credential_exports`
- `bump`

Header offsets:

```text
0   discriminator
1   version
2   agent pubkey
34  current_score i16
36  total_outcomes u64
44  successful_outcomes u32
48  failed_outcomes u32
52  buffer_cursor u8
53  entry_count u8
54  tier_checks u32
58  tier_correct u32
62  tier_retries u32
66  credential_exports u32
70  bump u8
71  outcomes[100]
```

Each outcome entry is 52 bytes:

```text
0   sequence u64
8   task pubkey
40  success bool/u8
41  score i16
43  tier u8
44  recorded_at i64
```

### Instructions

Pinocchio instruction data uses the first byte as the instruction tag:

```text
0 initialize_reputation
1 record_outcome
2 record_tier_accuracy
3 query_score
4 export_credential
```

#### `initialize_reputation(bump)`

Initializes a previously-created reputation PDA for an agent identity.

Accounts:

- `payer` signer
- `agent`
- `reputation` writable PDA

Instruction payload after tag:

```text
bump u8
```

Notes:

- PDA seed is `["rep", agent_pubkey]`.
- The account must already be allocated with `REPUTATION_ACCOUNT_LEN`.
- Account creation is intentionally left for ISSUE-02-07 client helpers.

#### `record_outcome(task, success, score, tier_used)`

Appends an outcome into a fixed 100-entry retained window and recomputes `current_score`.

Accounts:

- `authority` signer
- `agent`
- `reputation` writable PDA

Instruction payload after tag:

```text
task pubkey       32 bytes
success          u8, 0 or 1
score            i16 little-endian
tier_used        u8, 0 simple, 1 medium, 2 complex
```

Validation:

- score must be between `-100` and `100`
- reputation account agent must match passed agent
- outcome window must not already contain 100 entries

#### `record_tier_accuracy(predicted_tier, actual_tier_needed, retry_happened)`

Tracks Router Agent tier accuracy.

Accounts:

- `authority` signer
- `router_agent`
- `reputation` writable PDA

Instruction payload after tag:

```text
predicted_tier      u8
actual_tier_needed  u8
retry_happened      u8, 0 or 1
```

#### `query_score()`

Validates the reputation account and lets clients read `current_score` directly from account data offset `34`. Pinocchio does not provide the same Anchor-style return channel used by the earlier scaffold.

Accounts:

- `agent`
- `reputation` PDA

#### `export_credential()`

Phase 2 stub. Increments an export counter that can later be used by NFT/credential creation.

Accounts:

- `authority` signer
- `agent`
- `reputation` writable PDA

No credential/NFT account is minted in this issue.

### Scoring Algorithm

The current score is a weighted average over retained outcomes:

- successful outcome contributes `+score`
- failed outcome contributes `-abs(score)`
- entries within the latest 50 sequence numbers get weight `2`
- older retained entries get weight `1`
- result is clamped to `[-100, 100]`

This gives recent work more influence while still considering retained history.

The original plan mentions a circular buffer, but the acceptance criteria also says historical records must not be overwritten. This implementation prioritizes append-only semantics and rejects the 101st retained outcome with `OutcomeBufferFull`. A later archival/rollover design can preserve append-only history while moving older entries off-account or into secondary pages.

## What Remains For Other Issues

### ISSUE-02-01 and ISSUE-02-02

Still needed:

- real `AgentAccount`
- capability bitmap validation
- routing rules
- agent lifecycle updates
- slashing authority and `slash_reputation`
- registry queries for validator/orchestrator recruitment

### ISSUE-02-07

Still needed:

- final program IDs
- IDL export to `packages/idl`
- TypeScript client helpers
- event subscriptions
- RPC connection pool integration
- hardcoded/validated program ID wiring for CPI security

### Reputation Ledger Client Integration

Still needed:

- create/fund the `["rep", agent]` PDA before calling `initialize_reputation`
- expose TypeScript serializers for the instruction byte formats above
- expose TypeScript readers for `current_score`, counters, and retained outcomes
- decide how credentials/NFTs consume `credential_exports`
- benchmark `query_score` under the 5,000 CU target once Solana tooling is available

## Test And Build Commands

When Rust/Solana tooling is installed:

```bash
NO_DNA=1 anchor build
NO_DNA=1 anchor test
cargo test -p reputation-ledger
cargo build-sbf -p reputation-ledger --features bpf-entrypoint
cargo clippy --workspace --all-targets
```

The current environment used for this implementation did not have `cargo`, `anchor`, or `solana` available, so full Anchor validation could not be executed here.

## Risk Notes

- Program IDs are placeholders in `Anchor.toml`; CPI security should be hardened when real deployment IDs exist.
- `complete_subtask` validates a consensus authority PDA, but final production should pin the Consensus program id.
- `record_outcome` and `record_tier_accuracy` currently accept an authority signer without Agent Registry authorization. This is intentional until Agent Registry is implemented.
- `claim_timeout_refund` prepares timeout re-auction state but does not yet transfer funds back to creator.
- Reputation Ledger is implemented with Pinocchio and does not produce an Anchor IDL. ISSUE-02-07 should add explicit TypeScript serializers/readers for it.
