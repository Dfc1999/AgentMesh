# EPIC-06 Orchestrator Agent Implementation

## Scope Implemented

The Orchestrator module now coordinates the current AgentMesh flow from one task brief to a validated execution result.

Implemented issues:

- ISSUE-06-01: task decomposition into a DAG of subtasks.
- ISSUE-06-02: worker recruitment through the Agent Registry contract surface.
- ISSUE-06-03: parallel/sequential execution with topological ordering.
- ISSUE-06-04: event and timeout ports with a local adapter boundary.
- ISSUE-06-05: orchestrator fee release through the Task Escrow contract surface.

## Module Structure

Files added under `apps/agent-server/src/modules/orchestrator`:

- `domain/OrchestratorService.ts`: main use case. Optimizes the task brief, decomposes it, allocates subtasks, executes the DAG, and releases the orchestrator fee when all subtasks complete.
- `domain/TaskDecomposer.ts`: uses `claude-sonnet-4-6` through the LLM port to produce a JSON subtask tree. If the LLM call fails, it falls back to deterministic decomposition so local development still works.
- `domain/WorkerRecruiter.ts`: selects eligible workers by capability mask and reputation, then sorts by reputation descending and price ascending.
- `domain/ExecutionEngine.ts`: performs topological sort and runs every ready dependency level with `Promise.allSettled`.
- `domain/TimeoutManager.ts`: calculates heartbeat deadlines and detects timed-out running subtasks.
- `domain/capabilities.ts`: maps capability names to bitmasks used for Agent Registry recruitment.

Ports:

- `IOptimizerUseCase`
- `IRouterUseCase`
- `IJudgeUseCase`
- `IWorkerUseCase`
- `IAgentRegistry`
- `ITaskEscrow`
- `ISolanaEvents`
- `ITaskRepository`
- `IOrchestratorLlm`

Adapters:

- `OrchestratorLlmAdapter`: real LLM boundary using the shared `LLMClientFactory`.
- `SolanaAgentRegistryAdapter`: queries the shared Solana Agent Registry client surface.
- `SolanaTaskEscrowAdapter`: calls shared Task Escrow client methods.
- `InMemoryTaskRepository`: local persistence adapter until the Prisma task repository is added.
- `NoopSolanaEventsAdapter`: subscription boundary for Solana events; exposes the interface without opening a real WebSocket yet.
- `LocalWorkerAdapter`: deterministic local worker used only until EPIC-07 workers are implemented.
- `OrchestratorController`: HTTP entrypoint at `/orchestrator/tasks`.

## Real Integrations Used

The Orchestrator module is wired through Nest dependency injection to the existing modules:

- Optimizer: injected by `OPTIMIZER_USE_CASE`.
- Router: injected by `ROUTER_USE_CASE`.
- Judge: injected by `JUDGE_USE_CASE`.
- LLM: injected by `LLM_CLIENT_FACTORY`.

This means the Orchestrator does not import Router/Judge/Optimizer domain internals. It only consumes local ports that mirror their public use cases, keeping the hexagonal boundary intact.

The shared Solana contract surface was extended in `apps/agent-server/src/shared/solana/programs.ts`:

- `TaskEscrowClient.allocateSubtask`
- `TaskEscrowClient.releaseOrchestratorFee`
- optional `AgentRegistryClient.getAgentCandidatesByCapability`

The default provider still uses `createMockSolanaProgramClients()` because generated transaction-sending clients are not available yet. The Orchestrator adapters already call the final contract surface, so the future real client factory can replace the provider without changing the domain service.

## Execution Flow

1. `POST /orchestrator/tasks` receives a task brief and budget.
2. `OrchestratorService.start` runs the Optimizer on the full brief.
3. `TaskDecomposer` produces a DAG of subtasks and validates:
   - every dependency references an existing subtask,
   - no cycles exist,
   - total estimated subtask budget does not exceed the task budget after orchestrator fee.
4. The task tree is saved through `ITaskRepository`.
5. Each subtask is allocated through `ITaskEscrow.allocateSubtask`.
6. `ExecutionEngine` topologically sorts the DAG.
7. Every ready dependency level runs in parallel.
8. For each subtask:
   - `WorkerRecruiter` selects a worker from Agent Registry candidates.
   - Optimizer runs on the subtask prompt.
   - Router classifies tier/model/budget and declares tier.
   - Worker executes through `IWorkerUseCase`.
   - Judge evaluates the worker result.
   - If Judge requests one retry, the engine retries once and judges again.
9. If every subtask is completed, Task Escrow releases the orchestrator fee.

## Pending Dependencies

- EPIC-07 Workers: replace `LocalWorkerAdapter` with the real workers module adapter. The port is already `IWorkerUseCase`, so the domain does not need to change.
- Real Anchor/Pinocchio TypeScript clients: replace `createMockSolanaProgramClients()` with a real factory that signs and sends transactions for Agent Registry and Task Escrow.
- Postgres/Prisma operational persistence: replace `InMemoryTaskRepository` with a Prisma-backed adapter using the task/subtask schema.
- Solana WebSocket event parsing: replace `NoopSolanaEventsAdapter` with an adapter backed by the generated IDL events.
- EPIC-12 e2e tests should add local validator coverage for timeout, retry and fee release paths.

## Verification

Run:

```bash
npm run eval:orchestrator
npm run lint -- --filter=@agentmesh/agent-server
npm run build
```

The local eval covers:

- decomposition into three dependent subtasks,
- recruitment by reputation,
- sequential dependency execution,
- Judge approval,
- orchestrator fee release when all subtasks complete.
