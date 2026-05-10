# EPIC-07 Worker Agents Implementation

## Scope Implemented

EPIC-07 adds the worker layer consumed by the Orchestrator. The module now exposes a single `WORKER_USE_CASE` that can execute any worker type without changing Orchestrator code.

Implemented issues:

- ISSUE-07-01: base worker contract and shared execution logic.
- ISSUE-07-02: Researcher Agent with TypeScript coordinator and Python subprocess.
- ISSUE-07-03: Analyzer Agent with Python subprocess.
- ISSUE-07-04: Executor Agent with guarded DeFi simulation boundaries.
- ISSUE-07-05: Validator Agent with consensus submission and double-vote protection.

## Module Structure

Key files under `apps/agent-server/src/modules/workers`:

- `domain/base/BaseWorkerService.ts`: shared worker flow.
  - validates capabilities,
  - executes worker-specific logic,
  - hashes output,
  - automatically calls `taskEscrow.submitResult`,
  - logs structured events with `subtask_id`.
- `domain/researcher/ResearcherService.ts`: search + x402 boundary + Python research + LLM synthesis.
- `domain/analyzer/AnalyzerService.ts`: Python analysis + LLM report generation.
- `domain/executor/ExecutorService.ts`: Pyth/Jupiter quote and simulation checks. It does not broadcast a real transaction.
- `domain/validator/ValidatorService.ts`: independent validation and `consensus.submitValidation`.
- `domain/WorkerRegistryService.ts`: routes `WorkerTask` to the correct worker by kind or capability.

Python scripts:

- `workers-py/researcher/researcher.py`
- `workers-py/analyzer/analyzer.py`

## Integration With EPIC-06

`OrchestratorModule` now imports `WorkersModule` and injects `WORKER_USE_CASE`.

This replaces the previous local temporary worker adapter. The Orchestrator now calls the real Worker Registry port, and the registry dispatches to:

- `researcher`
- `analyzer`
- `executor`
- `validator`

The domain boundary remains hexagonal: Orchestrator still depends on its local `IWorkerUseCase` port, not worker internals.

## Solana And Consensus Boundaries

`TaskEscrowClient` was extended with:

- `submitResult({ subtaskPda, resultHash })`

Every worker automatically submits the result hash through `SolanaTaskEscrowAdapter`.

The Validator also calls:

- `ConsensusClient.submitValidation({ subtaskPda, approved, justificationHash })`

The default implementation still uses `createMockSolanaProgramClients()` until the real generated Anchor/Pinocchio clients exist. The contract surface is ready for that replacement.

## Dependencies Left For Later Epics

- EPIC-08 x402: `X402ClientAdapter` is a placeholder boundary. It returns a deterministic local response and documents the future paid HTTP behavior.
- Real web search APIs: `DeterministicWebSearchAdapter` avoids adding external provider keys. Replace it with DuckDuckGo/Bing/Playwright adapters when those provider decisions are made.
- Real Pyth/Jupiter/Raydium integration: `PythOracleAdapter` and `JupiterSwapAdapter` simulate quotes and transaction checks. Executor is intentionally guarded and does not broadcast real DeFi transactions yet.
- Persistent worker result storage: result content is returned to Orchestrator, but a Postgres result repository should be added before UI/SDK consumption.
- Agent wallets: wallet path is accepted in `SubtaskContext`, but keypair loading/funding belongs with the later wallet/gas management work.

## Verification

Run:

```bash
npm run eval:workers
npm run eval:orchestrator
npm run lint -- --filter=@agentmesh/agent-server
npm run build
```

The workers eval executes all four workers, checks automatic `submitResult` signatures, and exercises the Validator consensus path.
