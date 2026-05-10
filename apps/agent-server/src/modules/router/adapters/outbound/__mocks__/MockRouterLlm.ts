import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";
import { TierClassifier } from "../../../domain/TierClassifier";

export class MockRouterLlm {
  private readonly classifier = new TierClassifier();

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const prompt = req.messages.map((message) => message.content).join("\n");
    const contentMatch = prompt.match(/<query>([\s\S]*?)<\/query>/);
    const hintMatch = prompt.match(/complexityHint:\s*([0-9.]+)/);
    const tokenMatch = prompt.match(/processedTokens:\s*(\d+)/);
    const needsDocs = /needsDocs:\s*true/.test(prompt);
    const fallback = this.classifier.estimateWithoutLlm({
      content: contentMatch?.[1]?.trim() ?? prompt,
      intentClassification: {
        needsDocs,
        complexityHint: hintMatch ? Number(hintMatch[1]) : 0.5,
      },
      metrics: {
        cacheHit: false,
        originalTokens: tokenMatch ? Number(tokenMatch[1]) : 0,
        processedTokens: tokenMatch ? Number(tokenMatch[1]) : 0,
        reductionPercent: 0,
        techniquesApplied: [],
        estimatedQualityRisk: "low",
        latencyMs: 0,
      },
    });

    return {
      content: JSON.stringify(fallback),
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: 80,
      cachedTokens: 0,
      latencyMs: 5,
      provider: "mock",
      model: req.model,
    };
  }
}
