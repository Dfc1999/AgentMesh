import type { ModelId } from "@agentmesh/shared-types";
import type { LLMClientFactory } from "../../../../shared/llm/LLMClientFactory";
import type { CompletionRequest, CompletionResponse } from "../../../../shared/llm/types";
import type { IOrchestratorLlm } from "../../ports/outbound/IOrchestratorLlm";

export class OrchestratorLlmAdapter implements IOrchestratorLlm {
  constructor(private readonly llmFactory: LLMClientFactory) {}

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    return this.llmFactory.forModel(req.model as ModelId).complete(req);
  }
}
