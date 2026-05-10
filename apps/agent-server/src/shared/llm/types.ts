export type {
  CompletionMessage,
  CompletionRequest,
  CompletionResponse,
  ModelId,
} from "@agentmesh/shared-types";
import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";

export interface LLMClient {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

export interface LLMProviderConfig {
  openAiApiKey?: string;
  googleApiKey?: string;
  azureOpenAi?: {
    apiKey?: string;
    endpoint?: string;
    apiVersion: string;
    deployments: {
      gpt41Mini?: string;
      gpt41?: string;
      gpt5?: string;
    };
  };
}
