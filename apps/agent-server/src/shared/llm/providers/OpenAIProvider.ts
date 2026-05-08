import OpenAI from "openai";
import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";
import { BaseProvider } from "./BaseProvider";

export class OpenAIProvider extends BaseProvider {
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    super(150);
    this.client = new OpenAI({ apiKey });
  }

  protected async doComplete(req: CompletionRequest): Promise<CompletionResponse> {
    const startedAt = Date.now();
    const response = await this.client.chat.completions.create({
      model: req.model as never,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      messages: [
        ...(req.systemPrompt ? [{ role: "system" as const, content: req.systemPrompt }] : []),
        ...req.messages.map((message) => ({ role: message.role, content: message.content })),
      ] as never,
    });

    return {
      content: response.choices[0]?.message.content?.trim() ?? "",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      cachedTokens: 0,
      latencyMs: Date.now() - startedAt,
      provider: "openai",
      model: req.model,
    };
  }
}
