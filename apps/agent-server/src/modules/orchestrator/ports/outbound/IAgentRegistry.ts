import type { WorkerCandidate } from "../../domain/types";

export interface IAgentRegistry {
  getAgentsByCapability(
    capabilityMask: bigint,
    minReputation: number,
  ): Promise<WorkerCandidate[]>;

  registerOrchestrator?(input: {
    capabilities: bigint;
    commissionBps: number;
  }): Promise<string>;
}
