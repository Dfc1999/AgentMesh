import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";

export interface IWorkerLlm {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}
