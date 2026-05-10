export type {
  ModelId,
  RouterDecision,
  RouterWarning,
  RoutingRules,
  Tier,
} from "@agentmesh/shared-types";
import type { ModelId, RouterWarning, Tier } from "@agentmesh/shared-types";

export interface EscrowContext {
  routerAgentPda: string;
  subtaskPda: string;
  remainingBudgetLamports: bigint;
  maxRetryBudgetLamports?: bigint;
}

export interface RouterClassification {
  complexityScore: number;
  tokenEstimate: number;
  reasoningRequired: boolean;
  contextLength: number;
  confidence: number;
  reasoning: string;
}

export interface TierResolution {
  tier: Tier;
  modelId: ModelId;
  budgetSliceLamports: bigint;
  maxRetryBudgetLamports: bigint;
  warnings: RouterWarning[];
  reasoning: string;
}
