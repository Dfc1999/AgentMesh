import type { RetrievedChunk } from "@agentmesh/shared-types";
import type { IEmbeddingClient } from "../../ports/outbound/IEmbeddingClient";
import type { OptimizerConfig, OptimizerPipelineState, PipelineStep } from "../types";
import { cosineSimilarity, estimateTokens } from "../utils";

export class ContextPruningStep implements PipelineStep {
  readonly name = "context_pruning" as const;

  constructor(
    private readonly embedder: IEmbeddingClient,
    private readonly config: OptimizerConfig,
  ) {}

  async run(state: OptimizerPipelineState): Promise<OptimizerPipelineState> {
    if (!this.config.featureFlags.contextPruning || state.chunks.length <= 1) {
      return state;
    }

    const before = state.chunks;
    const kept: Array<{ chunk: RetrievedChunk; embedding: number[] }> = [];

    for (const chunk of before) {
      if (chunk.score < this.config.pruningMinRelevance) {
        continue;
      }

      const embedding = await this.embedder.embed(chunk.content);
      const duplicate = kept.some(
        (item) =>
          this.normalize(item.chunk.content) === this.normalize(chunk.content) ||
          cosineSimilarity(item.embedding, embedding) >= this.config.pruningDuplicateThreshold,
      );

      if (!duplicate) {
        kept.push({ chunk, embedding });
      }
    }

    const pruned = kept.map((item) => item.chunk);

    if (pruned.length === 0 && before.length > 0) {
      pruned.push([...before].sort((a, b) => b.score - a.score)[0]);
    }

    state.chunks = pruned;
    state.metrics.chunksBeforePruning = before.length;
    state.metrics.chunksAfterPruning = pruned.length;
    state.metrics.tokensEliminatedByPruning = Math.max(
      0,
      before.reduce((sum, chunk) => sum + estimateTokens(chunk.content), 0) -
        pruned.reduce((sum, chunk) => sum + estimateTokens(chunk.content), 0),
    );

    if (pruned.length !== before.length) {
      state.metrics.techniquesApplied.push(this.name);
      state.metrics.estimatedQualityRisk = "low";
    }

    return state;
  }

  private normalize(content: string): string {
    return content.toLowerCase().replace(/\s+/gu, " ").trim();
  }
}
