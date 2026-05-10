import type { IEmbeddingClient } from "../../ports/outbound/IEmbeddingClient";
import type { ISemanticCacheStore } from "../../ports/outbound/ISemanticCacheStore";
import type { OptimizerConfig, OptimizerPipelineState, PipelineStep } from "../types";

export class SemanticCacheStep implements PipelineStep {
  readonly name = "semantic_cache" as const;

  constructor(
    private readonly embedder: IEmbeddingClient,
    private readonly cache: ISemanticCacheStore,
    private readonly config: OptimizerConfig,
  ) {}

  async run(state: OptimizerPipelineState): Promise<OptimizerPipelineState> {
    const embedding = state.queryEmbedding ?? (await this.embedder.embed(state.rawQuery));
    state.queryEmbedding = embedding;

    if (!this.config.featureFlags.semanticCache) {
      return state;
    }

    const hit = await this.cache.search(embedding, this.config.semanticCacheThreshold);

    if (!hit) {
      return state;
    }

    state.metrics.cacheHit = true;
    state.metrics.cacheSimilarity = hit.similarity;
    state.metrics.tokensSavedByCache = state.metrics.originalTokens;
    state.metrics.processedTokens = 0;
    state.metrics.reductionPercent = 100;
    state.metrics.techniquesApplied.push(this.name);
    state.cachedResponse = hit.responseSummary;
    state.shortCircuit = true;

    return state;
  }
}
