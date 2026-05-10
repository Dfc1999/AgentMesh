import type { OptimizedQuery } from "@agentmesh/shared-types";
import type { IOptimizerUseCase } from "../ports/inbound/IOptimizerUseCase";
import type { ISemanticCacheStore } from "../ports/outbound/ISemanticCacheStore";
import type { OptimizerConfig, OptimizerPipelineState, PipelineStep } from "./types";
import { clampPercent, estimateTokens } from "./utils";

const DEFAULT_INTENT = {
  intent: "general" as const,
  needsDocs: false,
  complexityHint: 0,
};

export class OptimizerService implements IOptimizerUseCase {
  constructor(
    private readonly steps: readonly PipelineStep[],
    private readonly cache: ISemanticCacheStore,
    private readonly config: OptimizerConfig,
  ) {}

  async run(rawQuery: string): Promise<OptimizedQuery> {
    const startedAt = Date.now();
    const normalizedQuery = rawQuery.trim();

    if (!normalizedQuery) {
      throw new Error("Optimizer requires a non-empty query");
    }

    let state = this.createInitialState(normalizedQuery);

    for (const step of this.steps) {
      state = await step.run(state);

      if (state.shortCircuit) {
        break;
      }
    }

    state.metrics.latencyMs = Date.now() - startedAt;
    state.metrics.processedTokens = estimateTokens(state.processedQuery);
    state.metrics.reductionPercent = this.calculateReduction(
      state.metrics.originalTokens,
      state.metrics.processedTokens,
    );

    if (!state.shortCircuit && state.queryEmbedding) {
      await this.cache.store({
        embedding: state.queryEmbedding,
        responseSummary: state.processedQuery.slice(0, 1000),
        metadata: {
          intent: state.intent.intent,
          techniquesApplied: state.metrics.techniquesApplied,
        },
        ttlSeconds: this.resolveCacheTtl(state.intent.intent),
      });
    }

    return {
      content: state.processedQuery,
      intentClassification: {
        needsDocs: state.intent.needsDocs,
        complexityHint: state.intent.complexityHint,
        skillMatch: state.skillMatch?.skill.id ?? state.intent.skillId,
      },
      metrics: {
        cacheHit: state.metrics.cacheHit,
        originalTokens: state.metrics.originalTokens,
        processedTokens: state.metrics.processedTokens,
        reductionPercent: state.metrics.reductionPercent,
        techniquesApplied: state.metrics.techniquesApplied,
        estimatedQualityRisk: state.metrics.estimatedQualityRisk,
        latencyMs: state.metrics.latencyMs,
      },
      cachedResponse: state.cachedResponse,
      contextChunks: state.chunks.length > 0 ? state.chunks : undefined,
    };
  }

  private createInitialState(rawQuery: string): OptimizerPipelineState {
    const originalTokens = estimateTokens(rawQuery);

    return {
      rawQuery,
      processedQuery: rawQuery,
      intent: DEFAULT_INTENT,
      chunks: [],
      shortCircuit: false,
      metrics: {
        originalTokens,
        processedTokens: originalTokens,
        reductionPercent: 0,
        techniquesApplied: [],
        estimatedQualityRisk: "none",
        latencyMs: 0,
        cacheHit: false,
        tokensSavedByCache: 0,
        chunksBeforePruning: 0,
        chunksAfterPruning: 0,
        tokensEliminatedByPruning: 0,
        promptCacheEnabled: false,
        promptCachedTokens: 0,
      },
    };
  }

  private calculateReduction(originalTokens: number, processedTokens: number): number {
    if (originalTokens === 0) {
      return 0;
    }

    return clampPercent(((originalTokens - processedTokens) / originalTokens) * 100);
  }

  private resolveCacheTtl(intent: string): number {
    if (intent === "defi_arbitrage") {
      return this.config.defiCacheTtlSeconds;
    }

    return this.config.defaultCacheTtlSeconds;
  }
}
