import type { ModelId } from "@agentmesh/shared-types";
import { AnthropicProvider } from "./providers/AnthropicProvider";
import { GoogleProvider } from "./providers/GoogleProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import type { LLMClient, LLMProviderConfig } from "./types";

type ProviderName = "anthropic" | "openai" | "google";

const providerByModel: Record<ModelId, ProviderName> = {
  "claude-haiku-4-5": "anthropic",
  "claude-sonnet-4-6": "anthropic",
  "claude-opus-4-6": "anthropic",
  "gpt-4.1-mini": "openai",
  "gpt-4.1": "openai",
  "gpt-5": "openai",
  "gemini-flash-2.0": "google",
  "gemini-pro-2.5": "google",
};

export class LLMClientFactory {
  private readonly anthropic: LLMClient;
  private readonly openai: LLMClient;
  private readonly google?: LLMClient;

  constructor(config: LLMProviderConfig) {
    this.anthropic = new AnthropicProvider(config.anthropicApiKey);
    this.openai = new OpenAIProvider(config.openAiApiKey);
    this.google = config.googleApiKey ? new GoogleProvider(config.googleApiKey) : undefined;
  }

  forModel(model: ModelId): LLMClient {
    const provider = providerByModel[model];

    if (provider === "anthropic") {
      return this.anthropic;
    }

    if (provider === "openai") {
      return this.openai;
    }

    if (!this.google) {
      throw new Error(`Google provider requested for ${model}, but GOOGLE_API_KEY is not configured`);
    }

    return this.google;
  }
}
