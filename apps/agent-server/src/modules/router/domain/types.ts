export type {
  ModelId,
  RouterDecision,
  RouterWarning,
  RoutingRules,
  Tier,
} from "@agentmesh/shared-types";

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
  tier: import("@agentmesh/shared-types").Tier;
  modelId: import("@agentmesh/shared-types").ModelId;
  budgetSliceLamports: bigint;
  maxRetryBudgetLamports: bigint;
  warnings: import("@agentmesh/shared-types").RouterWarning[];
  reasoning: string;
}
