import type { ModelId } from "@agentmesh/shared-types";
import { AzureOpenAIProvider } from "./providers/AzureOpenAIProvider";
import { GoogleProvider } from "./providers/GoogleProvider";
import { OpenAIProvider } from "./providers/OpenAIProvider";
import type { LLMClient, LLMProviderConfig } from "./types";

type ProviderName = "azure-openai" | "openai" | "google";

const providerByModel: Record<ModelId, ProviderName> = {
  "gemini-2.5-flash-lite": "google",
  "gpt-4.1-mini": "azure-openai",
  "gpt-4.1": "azure-openai",
  "gpt-5": "azure-openai",
};

export class LLMClientFactory {
  private readonly openai?: LLMClient;
  private readonly azureOpenAi?: LLMClient;
  private readonly google?: LLMClient;

  constructor(config: LLMProviderConfig) {
    this.openai = config.openAiApiKey ? new OpenAIProvider(config.openAiApiKey) : undefined;
    this.azureOpenAi =
      config.azureOpenAi?.apiKey && config.azureOpenAi.endpoint
        ? new AzureOpenAIProvider(
            {
              apiKey: config.azureOpenAi.apiKey,
              endpoint: config.azureOpenAi.endpoint,
              apiVersion: config.azureOpenAi.apiVersion,
            },
            {
              "gpt-4.1-mini": config.azureOpenAi.deployments.gpt41Mini,
              "gpt-4.1": config.azureOpenAi.deployments.gpt41,
              "gpt-5": config.azureOpenAi.deployments.gpt5,
            },
          )
        : undefined;
    this.google = config.googleApiKey ? new GoogleProvider(config.googleApiKey) : undefined;
  }

  forModel(model: ModelId): LLMClient {
    const provider = providerByModel[model];

    if (provider === "openai") {
      if (!this.openai) {
        throw new Error(
          `OpenAI provider requested for ${model}, but OPENAI_API_KEY is not configured`,
        );
      }
      return this.openai;
    }

    if (provider === "azure-openai") {
      if (!this.azureOpenAi) {
        throw new Error(
          `Azure OpenAI provider requested for ${model}, but Azure OpenAI credentials are not configured`,
        );
      }
      return this.azureOpenAi;
    }

    if (!this.google) {
      throw new Error(
        `Google provider requested for ${model}, but GEMINI_API_KEY or GOOGLE_API_KEY is not configured`,
      );
    }

    return this.google;
  }
}
