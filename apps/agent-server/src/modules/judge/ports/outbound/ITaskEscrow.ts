import type { Tier } from "@agentmesh/shared-types";

export interface RetrySubtaskInput {
  subtaskPda: string;
  newTier: Tier;
  newWorker?: string;
}

export interface ITaskEscrow {
  retrySubtask(input: RetrySubtaskInput): Promise<string>;
}
