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
  anthropicApiKey: string;
  openAiApiKey: string;
  googleApiKey?: string;
}
