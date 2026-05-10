import type { ModelId } from "@agentmesh/shared-types";
import type { LLMClientFactory } from "../../../../shared/llm/LLMClientFactory";
import type { CompletionRequest, CompletionResponse } from "../../../../shared/llm/types";
import type { IWorkerLlm } from "../../ports/outbound/IWorkerLlm";

export class WorkerLlmAdapter implements IWorkerLlm {
  constructor(private readonly llmFactory: LLMClientFactory) {}

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    return this.llmFactory.forModel(req.model as ModelId).complete(req);
  }
}
