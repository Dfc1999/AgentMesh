import Anthropic from "@anthropic-ai/sdk";
import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";
import { BaseProvider } from "./BaseProvider";

export class AnthropicProvider extends BaseProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    super(150);
    this.client = new Anthropic({ apiKey });
  }

  protected async doComplete(req: CompletionRequest): Promise<CompletionResponse> {
    const startedAt = Date.now();
    const system = req.systemPrompt
      ? [
          req.cacheSystemPrompt
            ? {
                type: "text" as const,
                text: req.systemPrompt,
                cache_control: { type: "ephemeral" as const },
              }
            : {
                type: "text" as const,
                text: req.systemPrompt,
              },
        ]
      : undefined;

    const response = await this.client.messages.create({
      model: req.model as never,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      system: system as never,
      messages: req.messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
    });

    const usage = response.usage as typeof response.usage & { cache_read_input_tokens?: number };

    return {
      content: response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim(),
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedTokens: usage.cache_read_input_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
      provider: "anthropic",
      model: req.model,
    };
  }
}
