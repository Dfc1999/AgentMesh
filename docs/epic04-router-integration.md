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

## Real Integration Swap

When the real modules are ready:

- Replace `MockAgentRegistry` / `SolanaAgentRegistryAdapter.getRoutingRules` with an Anchor account fetch of the Router Agent account from `agent_registry`.
- Replace `SolanaTaskEscrowAdapter.declareTier` with the generated Anchor client call to `task_escrow::declare_tier`.
- Wire EPIC-03 `TokenOptimizer.run()` output directly into `RouterService.classify(query, escrowCtx)`.

No Router domain code should need to change for those swaps.

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
