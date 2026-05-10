import type { Tier } from "@agentmesh/shared-types";

export interface AllocateSubtaskInput {
  taskPda: string;
  subtaskPda: string;
  index: number;
  parentSubtaskPda?: string;
  budgetLamports: bigint;
  maxRetryBudgetLamports: bigint;
  estimatedTier: Tier;
}

export interface ITaskEscrow {
  allocateSubtask(input: AllocateSubtaskInput): Promise<string>;
  releaseOrchestratorFee(taskPda: string): Promise<string>;
}
