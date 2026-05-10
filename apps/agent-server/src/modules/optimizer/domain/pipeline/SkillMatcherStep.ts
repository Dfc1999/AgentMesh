import type { IEmbeddingClient } from "../../ports/outbound/IEmbeddingClient";
import type { ISkillStore } from "../../ports/outbound/ISkillStore";
import type { OptimizerConfig, OptimizerPipelineState, PipelineStep, SkillTemplate } from "../types";

export class SkillMatcherStep implements PipelineStep {
  readonly name = "skill_match_partial" as const;

  constructor(
    private readonly embedder: IEmbeddingClient,
    private readonly skillStore: ISkillStore,
    private readonly config: OptimizerConfig,
  ) {}

  async run(state: OptimizerPipelineState): Promise<OptimizerPipelineState> {
    if (!this.config.featureFlags.skillMatching) {
      return state;
    }

    const embedding = state.queryEmbedding ?? (await this.embedder.embed(state.rawQuery));
    state.queryEmbedding = embedding;

    const match = await this.skillStore.findBestMatch(embedding, this.config.skillPartialThreshold);

    if (!match) {
      return state;
    }

    const renderedTemplate = this.renderTemplate(match.skill, state.rawQuery);
    const exact = match.similarity >= this.config.skillExactThreshold;

    state.skillMatch = {
      ...match,
      renderedTemplate,
      exact,
    };

    if (exact) {
      state.processedQuery = renderedTemplate;
      state.cachedResponse = renderedTemplate;
      state.metrics.techniquesApplied.push("skill_match_exact");
      state.shortCircuit = true;
      return state;
    }

    state.metrics.techniquesApplied.push(this.name);
    return state;
  }

  private renderTemplate(skill: SkillTemplate, query: string): string {
    return skill.template
      .replaceAll("{{query}}", query)
      .replaceAll("{{skill_name}}", skill.name);
  }
}
