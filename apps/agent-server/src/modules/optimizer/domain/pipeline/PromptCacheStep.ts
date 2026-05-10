import type { OptimizerConfig, OptimizerPipelineState, PipelineStep } from "../types";
import { estimateTokens } from "../utils";

export class PromptCacheStep implements PipelineStep {
  readonly name = "prompt_cache" as const;

  constructor(private readonly config: OptimizerConfig) {}

  async run(state: OptimizerPipelineState): Promise<OptimizerPipelineState> {
    if (!this.config.featureFlags.promptCache) {
      return state;
    }

    state.metrics.promptCacheEnabled = true;
    state.metrics.promptCachedTokens = estimateTokens(this.buildCacheablePrefix(state.intent.intent));
    state.metrics.techniquesApplied.push(this.name);

    return state;
  }

  private buildCacheablePrefix(intent: string): string {
    return [
      "AgentMesh optimizer cacheable system prefix.",
      "Preserve user intent, avoid lossy compression, and keep facts auditable.",
      `Intent family: ${intent}.`,
    ].join(" ");
  }
}
