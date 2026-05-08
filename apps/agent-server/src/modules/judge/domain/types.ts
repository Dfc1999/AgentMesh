import type { RouterDecision, Tier } from "@agentmesh/shared-types";

export interface WorkerResponse {
  subtaskPda: string;
  content: string;
  resultHash: string;
}

export interface JudgeResult {
  approved: boolean;
  score: number;
  retryTier?: Tier;
  lowConfidence: boolean;
  routerDecision: RouterDecision;
}
