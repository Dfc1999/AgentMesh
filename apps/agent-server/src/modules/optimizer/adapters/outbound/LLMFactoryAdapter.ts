import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";
import type { LLMClient } from "../../../../shared/llm/types";
import type { LLMClientFactory } from "../../../../shared/llm/LLMClientFactory";

export class LLMFactoryAdapter implements LLMClient {
  constructor(private readonly factory: LLMClientFactory) {}

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    return this.factory.forModel(req.model).complete(req);
  }
}
