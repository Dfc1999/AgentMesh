import type { IRouterRetry, RouterReassignInput } from "../../../ports/outbound/IRouterRetry";

export class MockRouterRetry implements IRouterRetry {
  readonly reassignments: RouterReassignInput[] = [];

  async reassign(input: RouterReassignInput): Promise<void> {
    this.reassignments.push(input);
  }
}
