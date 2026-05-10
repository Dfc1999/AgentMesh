# EPIC-05 Judge Agent Integration Notes

## Scope

The Judge Agent evaluates a worker response against the original brief and decides whether to approve, retry at the next tier, or return a low-confidence result.

## Inputs

The Judge consumes:

- `RouterDecision` from EPIC-04.
- `WorkerResponse` from the worker/orchestrator path.

Both contracts live in `@agentmesh/shared-types`.

## Current Adapters

The domain service is wired through ports:

- `IJudgeLlm`: calls `claude-sonnet-4-6` for quality evaluation.
- `IConsensus`: submits approved validations.
- `ITaskEscrow`: calls retry when the answer fails and budget allows escalation.
- `IReputationLedger`: records router tier accuracy.
- `IRouterRetry`: notifies the Router/Orchestrator path that a retry tier is needed.

The Solana outbound adapters now depend on the shared client contracts in `apps/agent-server/src/shared/solana/programs.ts`:

- `SolanaConsensusAdapter` calls `clients.consensus.submitValidation`.
- `SolanaTaskEscrowAdapter` calls `clients.taskEscrow.retrySubtask`.
- `SolanaReputationLedgerAdapter` calls `clients.reputationLedger.recordTierAccuracy`.

The default Nest provider still injects `createMockSolanaProgramClients()` because the generated Anchor/Pinocchio TypeScript clients are not part of this epic yet. This keeps the application testable while preserving the real integration boundary for the future on-chain client implementation.

`RouterRetryAdapter` is intentionally still a no-op adapter. Real reassignment needs the EPIC-06 orchestrator flow so it can enqueue the retried subtask, select the new worker, and hand the task back to the Router/Worker path.

## Mocks And QA

Use these for local development:

- `MockJudgeLlm`
- `MockConsensus`
- `MockTaskEscrow`
- `MockReputationLedger`
- `MockRouterRetry`

They allow EPIC-05 to be tested before EPIC-06 and the remaining on-chain programs are production-ready.

The Postman QA controller uses these mocks on purpose under `/qa/*` endpoints. Production flow should resolve the use cases through the Nest modules and replace `JUDGE_SOLANA_CLIENTS` with the real Solana client factory when that client layer is implemented.

## Decision Rules

Default threshold: `0.75`.

- `score >= 0.75`: `approved`, calls `consensus.submitValidation`.
- `score < 0.75` and retry budget covers next tier: `retry`, calls `taskEscrow.retrySubtask` and `routerRetry.reassign`.
- `score < 0.75` without retry budget: `low_confidence`, returns the best available content.

Tier escalation is single-step only:

- `simple -> medium`
- `medium -> complex`
- `complex` does not escalate

## Verification

Run:

```bash
npm run lint -- --filter=@agentmesh/agent-server
npm run build -- --filter=@agentmesh/agent-server
npm run eval:judge
npm run eval:router
npm run build
```

Full on-chain build check:

```bash
anchor build
```

## Pending Integration Dependencies

- EPIC-02 provides the on-chain programs and shared client contract surface. EPIC-05 is already wired to that surface, but still needs a real client factory that signs and sends transactions.
- EPIC-03 is only an upstream dependency through `OptimizedQuery` and the Router flow; Judge does not call the optimizer directly.
- EPIC-04 is integrated through `RouterDecision`. Judge uses the selected tier, model, budget and subtask PDA from Router.
- EPIC-06 should replace `RouterRetryAdapter` with real retry orchestration.
- Future client-generation work should implement `ConsensusClient`, `TaskEscrowClient`, and `ReputationLedgerClient` in `shared/solana/programs.ts` without changing `JudgeService`.
