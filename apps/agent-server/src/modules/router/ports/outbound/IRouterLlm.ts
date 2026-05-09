import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";

export interface IRouterLlm {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}
