import type { ModelId, OptimizedQuery, RoutingRules, Tier } from "@agentmesh/shared-types";
import type { RouterClassification, TierResolution } from "./types";

export const DEFAULT_ROUTING_RULES: RoutingRules = {
  simpleMaxTokens: 50,
  simpleMaxComplexity: 0.3,
  mediumMaxTokens: 500,
  mediumMaxComplexity: 0.7,
  minReputationScore: -50,
  maxRetries: 1,
};

const MODEL_BY_TIER: Record<Tier, ModelId> = {
  simple: "claude-haiku-4-5",
  medium: "claude-sonnet-4-6",
  complex: "claude-opus-4-6",
};

const MIN_BUDGET_BY_TIER: Record<Tier, bigint> = {
  simple: 300_000n,
  medium: 900_000n,
  complex: 2_400_000n,
};

const RETRY_BUDGET_BY_TIER: Record<Tier, bigint> = {
  simple: 600_000n,
  medium: 1_500_000n,
  complex: 0n,
};

export class TierClassifier {
  classifyWithRules(
    query: OptimizedQuery,
    classification: RouterClassification,
    rules: RoutingRules = DEFAULT_ROUTING_RULES,
    remainingBudgetLamports: bigint,
    requestedRetryBudgetLamports?: bigint,
  ): TierResolution {
    const preferredTier = this.resolvePreferredTier(query, classification, rules);
    const { tier, degraded } = this.applyBudget(preferredTier, remainingBudgetLamports);
    const warnings = degraded ? (["budget_degraded"] as const) : [];
    const budgetSliceLamports = this.calculateBudgetSlice(tier, remainingBudgetLamports);
    const defaultRetryBudget = RETRY_BUDGET_BY_TIER[tier];
    const maxRetryBudgetLamports =
      requestedRetryBudgetLamports === undefined
        ? defaultRetryBudget
        : requestedRetryBudgetLamports < defaultRetryBudget
          ? requestedRetryBudgetLamports
          : defaultRetryBudget;

    if (budgetSliceLamports === 0n) {
      return {
        tier: "simple",
        modelId: MODEL_BY_TIER.simple,
        budgetSliceLamports: 0n,
        maxRetryBudgetLamports: 0n,
        warnings: ["insufficient_budget"],
        reasoning: "Remaining budget cannot cover the minimum simple tier spend.",
      };
    }

    return {
      tier,
      modelId: MODEL_BY_TIER[tier],
      budgetSliceLamports,
      maxRetryBudgetLamports,
      warnings: [...warnings],
      reasoning: `${classification.reasoning} Preferred tier ${preferredTier}; resolved tier ${tier}.`,
    };
  }

  estimateWithoutLlm(query: OptimizedQuery): RouterClassification {
    const content = query.content.trim();
    const tokenEstimate = Math.max(query.metrics.processedTokens, estimateTokens(content));
    const lower = content.toLowerCase();
    const reasoningKeywords = [
      "analiza",
      "analysis",
      "compara",
      "diseña",
      "arquitectura",
      "debug",
      "implementa",
      "estrategia",
      "tradeoff",
      "razona",
      "multi-step",
    ];
    const complexKeywords = [
      "sistema",
      "end-to-end",
      "auditoría",
      "security",
      "optimización",
      "investigación",
      "documentos",
      "código",
      "roadmap",
    ];
    const reasoningRequired = reasoningKeywords.some((keyword) => lower.includes(keyword));
    const contextLength = query.contextChunks?.length ?? 0;
    const keywordBoost = complexKeywords.filter((keyword) => lower.includes(keyword)).length * 0.08;
    const docBoost = query.intentClassification.needsDocs ? 0.12 : 0;
    const contextBoost = Math.min(contextLength * 0.05, 0.2);
    const tokenBoost =
      tokenEstimate > 800 ? 0.25 : tokenEstimate > 250 ? 0.14 : tokenEstimate > 80 ? 0.06 : 0;
    const reasoningBoost = reasoningRequired ? 0.18 : 0;
    const hint = clamp(query.intentClassification.complexityHint, 0, 1);
    const complexityScore = clamp(
      hint * 0.55 + keywordBoost + docBoost + contextBoost + tokenBoost + reasoningBoost,
      0,
      1,
    );

    return {
      complexityScore,
      tokenEstimate,
      reasoningRequired,
      contextLength,
      confidence: 0.74,
      reasoning:
        "Deterministic fallback classifier used because no router LLM result was available.",
    };
  }

  private resolvePreferredTier(
    query: OptimizedQuery,
    classification: RouterClassification,
    rules: RoutingRules,
  ): Tier {
    if (
      classification.complexityScore <= rules.simpleMaxComplexity &&
      classification.tokenEstimate <= rules.simpleMaxTokens &&
      !classification.reasoningRequired &&
      !query.intentClassification.needsDocs
    ) {
      return "simple";
    }

    if (
      classification.complexityScore <= rules.mediumMaxComplexity &&
      classification.tokenEstimate <= rules.mediumMaxTokens
    ) {
      return "medium";
    }

    return "complex";
  }

  private applyBudget(
    preferredTier: Tier,
    remainingBudgetLamports: bigint,
  ): { tier: Tier; degraded: boolean } {
    if (remainingBudgetLamports >= MIN_BUDGET_BY_TIER[preferredTier]) {
      return { tier: preferredTier, degraded: false };
    }

    if (preferredTier === "complex" && remainingBudgetLamports >= MIN_BUDGET_BY_TIER.medium) {
      return { tier: "medium", degraded: true };
    }

    if (preferredTier !== "simple" && remainingBudgetLamports >= MIN_BUDGET_BY_TIER.simple) {
      return { tier: "simple", degraded: true };
    }

    return { tier: "simple", degraded: preferredTier !== "simple" };
  }

  private calculateBudgetSlice(tier: Tier, remainingBudgetLamports: bigint): bigint {
    const minimum = MIN_BUDGET_BY_TIER[tier];
    if (remainingBudgetLamports < minimum) {
      return 0n;
    }

    const preferred = minimum + RETRY_BUDGET_BY_TIER[tier];
    return preferred > remainingBudgetLamports ? remainingBudgetLamports : preferred;
  }
}

function estimateTokens(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return Math.ceil(content.split(/\s+/).length * 1.3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
