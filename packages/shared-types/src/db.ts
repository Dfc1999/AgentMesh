export interface AgentRecord {
  id: string;
  ownerPubkey: string;
  class: string;
  capabilities: bigint;
  reputationScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskRecord {
  id: string;
  creatorPubkey: string;
  brief: string;
  briefHash: string;
  status: string;
  budgetLamports: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubtaskRecord {
  id: string;
  taskId: string;
  parentSubtaskId: string | null;
  workerAgentId: string | null;
  declaredTier: string | null;
  status: string;
  allocatedBudgetLamports: bigint;
  resultHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OptimizerMetricRecord {
  id: string;
  taskId: string | null;
  cacheHit: boolean;
  originalTokens: number;
  processedTokens: number;
  reductionPercent: number;
  techniquesApplied: string[];
  estimatedQualityRisk: string;
  latencyMs: number;
  createdAt: Date;
}
