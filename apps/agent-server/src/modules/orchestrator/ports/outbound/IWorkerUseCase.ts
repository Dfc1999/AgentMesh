import type { ModelId, Tier } from "@agentmesh/shared-types";
import type { WorkerKind } from "../../../workers";

export interface WorkerTask {
  subtaskId: string;
  subtaskPda: string;
  workerAgentPda: string;
  kind?: WorkerKind;
  prompt: string;
  originalBrief: string;
  tier: Tier;
  modelId: ModelId;
  budgetLamports: bigint;
  requiredCapabilities?: bigint;
  producerAgentPda?: string;
}

export interface WorkerResult {
  subtaskId: string;
  subtaskPda: string;
  content: string;
  resultHash: string;
  tokensUsed: number;
  costLamports: number;
  workerAgentPda?: string;
}

export interface IWorkerUseCase {
  execute(task: WorkerTask): Promise<WorkerResult>;
}
