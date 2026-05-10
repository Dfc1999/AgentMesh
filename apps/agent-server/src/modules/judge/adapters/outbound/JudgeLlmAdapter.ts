import type { CompletionRequest, CompletionResponse, ModelId } from "@agentmesh/shared-types";
import type { LLMClientFactory } from "../../../../shared/llm/LLMClientFactory";
import type { IJudgeLlm } from "../../ports/outbound/IJudgeLlm";

export class JudgeLlmAdapter implements IJudgeLlm {
  constructor(private readonly llmFactory: LLMClientFactory) {}

  complete(req: CompletionRequest): Promise<CompletionResponse> {
    return this.llmFactory.forModel(req.model as ModelId).complete(req);
  }
}
