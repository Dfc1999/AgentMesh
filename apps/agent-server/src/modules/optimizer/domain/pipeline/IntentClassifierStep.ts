import type { CompletionResponse } from "@agentmesh/shared-types";
import type { LLMClient } from "../../../../shared/llm/types";
import type { OptimizerPipelineState, PipelineStep } from "../types";

export class IntentClassifierStep implements PipelineStep {
  readonly name = "intent_classifier" as const;

  constructor(private readonly llm: LLMClient) {}

  async run(state: OptimizerPipelineState): Promise<OptimizerPipelineState> {
    const heuristic = this.classifyWithHeuristics(state.rawQuery);

    try {
      const response = await this.llm.complete({
        model: "claude-haiku-4-5",
        maxTokens: 200,
        temperature: 0,
        cacheSystemPrompt: true,
        systemPrompt:
          "Classify AgentMesh tasks. Return compact JSON with intent, needsDocs, complexityHint, and optional skillId.",
        messages: [{ role: "user", content: state.rawQuery }],
      });

      state.intent = this.parseResponse(response, heuristic);
    } catch {
      state.intent = heuristic;
    }

    state.metrics.techniquesApplied.push(this.name);
    return state;
  }

  private parseResponse(response: CompletionResponse, fallback: OptimizerPipelineState["intent"]) {
    try {
      const parsed = JSON.parse(response.content) as Partial<OptimizerPipelineState["intent"]>;

      return {
        intent: parsed.intent ?? fallback.intent,
        needsDocs: parsed.needsDocs ?? fallback.needsDocs,
        complexityHint: this.clampComplexity(parsed.complexityHint ?? fallback.complexityHint),
        skillId: parsed.skillId ?? fallback.skillId,
      };
    } catch {
      return fallback;
    }
  }

  private classifyWithHeuristics(query: string): OptimizerPipelineState["intent"] {
    const lower = query.toLowerCase();

    if (lower.includes("arbitrage") || lower.includes("defi") || lower.includes("liquidity")) {
      return { intent: "defi_arbitrage", needsDocs: true, complexityHint: 0.8, skillId: "defi-arbitrage" };
    }

    if (lower.includes("code") || lower.includes("pull request") || lower.includes("review")) {
      return { intent: "code_review", needsDocs: false, complexityHint: 0.55, skillId: "code-review" };
    }

    if (lower.includes("market") || lower.includes("competitor") || lower.includes("research")) {
      return { intent: "market_research", needsDocs: true, complexityHint: 0.65, skillId: "market-research" };
    }

    if (lower.includes("summarize") || lower.includes("summary") || lower.includes("resumen")) {
      return { intent: "text_summary", needsDocs: false, complexityHint: 0.25, skillId: "text-summary" };
    }

    if (lower.includes("data") || lower.includes("csv") || lower.includes("analysis")) {
      return { intent: "data_analysis", needsDocs: false, complexityHint: 0.6, skillId: "data-analysis" };
    }

    return { intent: "general", needsDocs: false, complexityHint: 0.45 };
  }

  private clampComplexity(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.max(0, Math.min(1, value));
  }
}
