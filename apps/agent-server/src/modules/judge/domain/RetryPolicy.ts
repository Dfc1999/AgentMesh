import type { RouterDecision, Tier, WorkerResponse } from "@agentmesh/shared-types";
import type { RetryDecision } from "./types";

export const DEFAULT_JUDGE_THRESHOLD = 0.75;
export const DEFAULT_MAX_RETRIES = 1;

const NEXT_TIER: Partial<Record<Tier, Tier>> = {
  simple: "medium",
  medium: "complex",
};

const NEXT_TIER_COST: Record<Tier, number> = {
  simple: 900_000,
  medium: 2_400_000,
  complex: Number.POSITIVE_INFINITY,
};

export class RetryPolicy {
  constructor(
    private readonly threshold = DEFAULT_JUDGE_THRESHOLD,
    private readonly maxRetries = DEFAULT_MAX_RETRIES,
  ) {}

  decide(score: number, response: WorkerResponse, decision: RouterDecision): RetryDecision {
    if (score >= this.threshold) {
      return {
        verdict: "approved",
        tierWasAccurate: true,
      };
    }

    const retryTier = NEXT_TIER[decision.tier];
    const retryCount = response.retryCount ?? 0;
    const nextTierCost = NEXT_TIER_COST[decision.tier];
    const canRetry =
      retryTier !== undefined &&
      retryCount < this.maxRetries &&
      decision.maxRetryBudget >= nextTierCost &&
      !decision.warnings.includes("insufficient_budget");

    if (canRetry) {
      return {
        verdict: "retry",
        retryTier,
        tierWasAccurate: false,
      };
    }

    return {
      verdict: "low_confidence",
      tierWasAccurate: false,
      lowConfidenceReason: `Score ${score.toFixed(2)} is below threshold ${this.threshold.toFixed(
        2,
      )}, and retry is unavailable or over budget.`,
    };
  }
}
