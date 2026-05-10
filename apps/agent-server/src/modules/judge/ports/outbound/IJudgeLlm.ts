import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";

export interface IJudgeLlm {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}
