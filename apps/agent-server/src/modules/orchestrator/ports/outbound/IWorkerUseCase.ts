import type { ModelId, Tier } from "@agentmesh/shared-types";

export interface WorkerTask {
  subtaskId: string;
  subtaskPda: string;
  workerAgentPda: string;
  prompt: string;
  originalBrief: string;
  tier: Tier;
  modelId: ModelId;
  budgetLamports: bigint;
}

export interface WorkerResult {
  subtaskId: string;
  subtaskPda: string;
  content: string;
  resultHash: string;
  tokensUsed: number;
  costLamports: number;
}

export interface IWorkerUseCase {
  execute(task: WorkerTask): Promise<WorkerResult>;
}
