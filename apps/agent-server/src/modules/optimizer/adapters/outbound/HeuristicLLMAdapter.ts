import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";
import type { LLMClient } from "../../../../shared/llm/types";

export class HeuristicLLMAdapter implements LLMClient {
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const content = req.messages.map((message) => message.content).join("\n").toLowerCase();
    const intent = this.resolveIntent(content);
    const response = JSON.stringify(intent);

    return {
      content: response,
      inputTokens: Math.ceil(content.length / 4),
      outputTokens: Math.ceil(response.length / 4),
      cachedTokens: req.cacheSystemPrompt && req.systemPrompt ? Math.ceil(req.systemPrompt.length / 4) : 0,
      latencyMs: 1,
      provider: "mock",
      model: req.model,
    };
  }

  private resolveIntent(content: string) {
    if (content.includes("defi") || content.includes("arbitrage")) {
      return { intent: "defi_arbitrage", needsDocs: true, complexityHint: 0.8, skillId: "defi-arbitrage" };
    }

    if (content.includes("review") || content.includes("code")) {
      return { intent: "code_review", needsDocs: false, complexityHint: 0.55, skillId: "code-review" };
    }

    if (content.includes("market") || content.includes("research")) {
      return { intent: "market_research", needsDocs: true, complexityHint: 0.65, skillId: "market-research" };
    }

    if (content.includes("summary") || content.includes("summarize") || content.includes("resumen")) {
      return { intent: "text_summary", needsDocs: false, complexityHint: 0.25, skillId: "text-summary" };
    }

    if (content.includes("data") || content.includes("csv") || content.includes("analysis")) {
      return { intent: "data_analysis", needsDocs: false, complexityHint: 0.6, skillId: "data-analysis" };
    }

    return { intent: "general", needsDocs: false, complexityHint: 0.45 };
  }
}
