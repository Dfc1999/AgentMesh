import type { IVectorStore } from "../../ports/outbound/IVectorStore";
import type { OptimizerConfig, OptimizerPipelineState, PipelineStep } from "../types";

export class RagSearchStep implements PipelineStep {
  readonly name = "rag_search" as const;

  constructor(
    private readonly vectorStore: IVectorStore,
    private readonly config: OptimizerConfig,
  ) {}

  async run(state: OptimizerPipelineState): Promise<OptimizerPipelineState> {
    if (!this.config.featureFlags.ragSearch || !state.intent.needsDocs || !state.queryEmbedding) {
      return state;
    }

    const chunks = await this.vectorStore.search(
      state.queryEmbedding,
      this.config.ragTopK,
      this.config.ragMinScore,
    );

    if (chunks.length === 0) {
      return state;
    }

    state.chunks = chunks;
    state.metrics.techniquesApplied.push(this.name);
    state.metrics.chunksBeforePruning = chunks.length;

    return state;
  }
}
