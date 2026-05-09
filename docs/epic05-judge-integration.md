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

Until the full Anchor clients for Consensus and Task Escrow are implemented, the Solana adapters return auditable placeholder signatures and the mocks record calls in memory.

## Mocks

Use these for local development:

- `MockJudgeLlm`
- `MockConsensus`
- `MockTaskEscrow`
- `MockReputationLedger`
- `MockRouterRetry`

They allow EPIC-05 to be tested before EPIC-06 and the remaining on-chain programs are production-ready.

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
npm run eval:judge
npm run build
```

Full on-chain build check:

```bash
anchor build
```
