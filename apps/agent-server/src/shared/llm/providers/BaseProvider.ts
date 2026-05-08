import type { CompletionRequest, CompletionResponse } from "@agentmesh/shared-types";
import { RateLimiter } from "../RateLimiter";
import { RetryHandler } from "../RetryHandler";
import type { LLMClient } from "../types";

export abstract class BaseProvider implements LLMClient {
  protected readonly retryHandler = new RetryHandler();
  protected readonly rateLimiter: RateLimiter;

  protected constructor(minIntervalMs: number) {
    this.rateLimiter = new RateLimiter(minIntervalMs);
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    await this.rateLimiter.wait();
    return this.retryHandler.run(() => this.doComplete(req));
  }

  protected abstract doComplete(req: CompletionRequest): Promise<CompletionResponse>;
}
