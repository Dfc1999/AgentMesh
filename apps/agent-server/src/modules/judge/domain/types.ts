export type {
  DimensionScores,
  JudgeResult,
  JudgeVerdict,
  RouterDecision,
  Tier,
  WorkerResponse,
} from "@agentmesh/shared-types";

import type { DimensionScores, JudgeVerdict, Tier } from "@agentmesh/shared-types";

export interface JudgeThresholds {
  defaultThreshold: number;
}

export interface JudgeEvaluation {
  score: number;
  dimensions: DimensionScores;
  reasoning: string;
}

export interface RetryDecision {
  verdict: JudgeVerdict;
  retryTier?: Tier;
  tierWasAccurate: boolean;
  lowConfidenceReason?: string;
}
