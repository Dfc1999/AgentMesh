import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";

export interface IOrchestratorLlm {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}
