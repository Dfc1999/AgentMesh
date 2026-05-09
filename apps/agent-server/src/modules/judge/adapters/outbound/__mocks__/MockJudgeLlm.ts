import type {
  CompletionRequest,
  CompletionResponse,
  DimensionScores,
} from "@agentmesh/shared-types";

export class MockJudgeLlm {
  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const prompt = req.messages.map((message) => message.content).join("\n");
    const brief = prompt.match(/<brief>([\s\S]*?)<\/brief>/)?.[1] ?? "";
    const content = prompt.match(/<worker_response>([\s\S]*?)<\/worker_response>/)?.[1] ?? "";
    const dimensions = scoreHeuristically(brief, content);

    return {
      content: JSON.stringify({
        dimensions,
        reasoning: "Mock Judge LLM generated deterministic dimension scores.",
      }),
      inputTokens: Math.ceil(prompt.length / 4),
      outputTokens: 120,
      cachedTokens: 0,
      latencyMs: 8,
      provider: "mock",
      model: req.model,
    };
  }
}

function scoreHeuristically(brief: string, content: string): DimensionScores {
  const lowerBrief = brief.toLowerCase();
  const lowerContent = content.toLowerCase();
  const briefTerms = lowerBrief
    .split(/\W+/)
    .filter((term) => term.length > 4)
    .slice(0, 10);
  const coverage =
    briefTerms.length === 0
      ? 0.7
      : briefTerms.filter((term) => lowerContent.includes(term)).length / briefTerms.length;
  const enoughDetail = content.length > Math.max(brief.length, 80);
  const malformed = /lorem|todo|n\/a|no sé|no puedo/i.test(content);
  const asksStructure = /lista|tabla|json|pasos|formato/i.test(brief);
  const hasStructure = /(\n-|\n\d+\.|{|\|)/.test(content);

  return {
    completeness: malformed ? 0.25 : round(coverage * 0.75 + (enoughDetail ? 0.2 : 0.05)),
    consistency: malformed ? 0.35 : 0.86,
    formatCompliance: asksStructure ? (hasStructure ? 0.88 : 0.42) : 0.82,
    appropriateConfidence: /\b(aproximad|puede|podría|estimad|likely|may)\b/i.test(content)
      ? 0.86
      : 0.72,
  };
}

function round(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}
