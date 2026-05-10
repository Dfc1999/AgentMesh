# EPIC-04 Router Agent Integration Notes

## Scope

This document explains how the Router Agent can run before EPIC-03 is complete and what must be swapped when the Optimizer and real on-chain clients are ready.

## Input From EPIC-03

The Router consumes `OptimizedQuery` from `@agentmesh/shared-types`.

Required fields:

```ts
{
  content: string;
  intentClassification: {
    needsDocs: boolean;
    complexityHint: number;
    skillId?: string;
    skillMatch?: string;
  };
  metrics: {
    cacheHit: boolean;
    originalTokens: number;
    processedTokens: number;
    reductionPercent: number;
    techniquesApplied: string[];
    estimatedQualityRisk: "none" | "low" | "medium" | "high";
    latencyMs: number;
  };
  cachedResponse?: string;
}
```

Compatibility note: the interface contract document uses `skillId`, while the current shared type previously used `skillMatch`. Router supports both and prefers `skillId`.

## Local Mocks

The Router includes these mocks:

- `MockRouterLlm`: deterministic local complexity estimation with the same JSON shape expected from the cheap router LLM.
- `MockAgentRegistry`: returns default routing rules and optional skill-template matches.
- `MockTaskEscrow`: records `declareTier` calls in memory and returns a mock signature.

Use these while EPIC-03 and Task Escrow client work are in progress.

## Current Project Integration

This integration was merged selectively from `feature/epic-04-router-agent` because that branch was based on an older `main`. A direct merge would have removed EPIC-02 and EPIC-03 files that already exist in the current project.

The Router now compiles against the current EPIC-03 `OptimizedQuery` contract:

- `skillId` and `skillMatch` are both supported.
- `cacheHit` short-circuits routing and returns `cachedResponse`.
- `contextChunks`, `complexityHint`, `processedTokens`, and `estimatedQualityRisk` influence tier selection.

The public provider token is `ROUTER_USE_CASE` from `apps/agent-server/src/modules/router/router.module.ts`.

## Real Integration Swap

When the real modules are ready:

- Replace `MockAgentRegistry` / `SolanaAgentRegistryAdapter.getRoutingRules` with an Anchor account fetch of the Router Agent account from `agent_registry`.
- Replace `SolanaTaskEscrowAdapter.declareTier` with the generated Anchor client call to `task_escrow::declare_tier`.
- Wire EPIC-03 `TokenOptimizer.run()` output directly into `RouterService.classify(query, escrowCtx)`.

No Router domain code should need to change for those swaps.

## Mocked or Pending Dependencies

- `SolanaAgentRegistryAdapter` now uses the shared EPIC-02 `AgentRegistryClient.getRoutingRules(agentPda)` contract. The default module wiring still injects `createMockSolanaProgramClients()` until an Anchor-backed client exists.
- `SolanaTaskEscrowAdapter` now uses the shared EPIC-02 `TaskEscrowClient.declareTier(input)` contract. The default module wiring still injects the mock client, so it returns a mock signature until the Anchor transaction adapter is implemented.
- `scripts/register-router-agent.ts` uses `createMockSolanaProgramClients`; replace it with the generated Anchor client before Devnet registration.
- There is no Router HTTP controller yet. EPIC-06 Orchestrator should consume `ROUTER_USE_CASE` through Nest dependency injection.
- The cheap Router LLM path is wired through `RouterLlmAdapter` and `LLMClientFactory`. For deterministic tests, use `MockRouterLlm`.

## Dependencies With Other Epics

EPIC-02:
- Requires `agent_registry` routing rules to be readable off-chain.
- Requires `task_escrow::declare_tier` client integration before real task execution.

EPIC-03:
- Must run before Router. Router expects an `OptimizedQuery`, not raw user text.
- Cache hits and exact skill matches can skip on-chain tier declaration.

EPIC-05:
- Judge should consume `RouterDecision.tier`, `modelId`, `budgetSliceLamports`, `maxRetryBudget`, and `warnings`.
- `budget_degraded` and `insufficient_budget` should influence retry and low-confidence behavior.

EPIC-06:
- Orchestrator owns the flow: Optimizer -> Router -> Worker -> Judge.
- Orchestrator must provide `EscrowContext` with `routerAgentPda`, `subtaskPda`, and remaining budget.

## Budget Behavior

The Router first resolves a preferred tier using complexity, token estimate, reasoning requirement, docs requirement, and registry rules.

If budget is too low:

- complex can degrade to medium;
- medium/complex can degrade to simple;
- if even simple is unaffordable, the decision includes `warnings: ["insufficient_budget"]` and does not call `declareTier`.

## Verification

Run:

```bash
npm run build
npx tsx scripts/eval-router.ts
```

For full Anchor validation:

```bash
anchor build
```
