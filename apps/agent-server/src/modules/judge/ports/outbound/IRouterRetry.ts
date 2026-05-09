import type { Tier } from "@agentmesh/shared-types";

export interface RouterReassignInput {
  subtaskId: string;
  subtaskPda: string;
  tier: Tier;
}

export interface IRouterRetry {
  reassign(input: RouterReassignInput): Promise<void>;
}
