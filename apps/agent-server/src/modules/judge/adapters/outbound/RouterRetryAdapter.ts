import type { IRouterRetry, RouterReassignInput } from "../../ports/outbound/IRouterRetry";

export class RouterRetryAdapter implements IRouterRetry {
  async reassign(input: RouterReassignInput): Promise<void> {
    void input;
    return undefined;
  }
}
