import type { CompletionRequest, CompletionResponse, ModelId } from "@agentmesh/shared-types";
import type { LLMClientFactory } from "../../../../shared/llm/LLMClientFactory";
import type { IRouterLlm } from "../../ports/outbound/IRouterLlm";

export class RouterLlmAdapter implements IRouterLlm {
  constructor(private readonly llmFactory: LLMClientFactory) {}

  complete(req: CompletionRequest): Promise<CompletionResponse> {
    return this.llmFactory.forModel(req.model as ModelId).complete(req);
  }
}
