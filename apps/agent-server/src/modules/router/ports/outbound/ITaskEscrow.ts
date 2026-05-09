import type { ModelId, Tier } from "@agentmesh/shared-types";

export interface DeclareTierInput {
  subtaskPda: string;
  tier: Tier;
  modelId: ModelId;
  budgetSliceLamports: bigint;
}

export interface ITaskEscrow {
  declareTier(input: DeclareTierInput): Promise<string>;
}
