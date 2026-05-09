import type { Tier } from "@agentmesh/shared-types";

export interface RecordTierAccuracyInput {
  routerAgent: string;
  predictedTier: Tier;
  actualTierNeeded: Tier;
  retryHappened: boolean;
}

export interface IReputationLedger {
  recordTierAccuracy(input: RecordTierAccuracyInput): Promise<string>;
}
