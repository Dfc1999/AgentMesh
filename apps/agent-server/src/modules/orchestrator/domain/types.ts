import type {
  AgentClass,
  JudgeResult,
  OptimizedQuery,
  RouterDecision,
  Tier,
} from "@agentmesh/shared-types";

export type OrchestratorStatus =
  | "accepted"
  | "completed"
  | "partial_failure"
  | "rejected";

export type SubtaskStatus =
  | "pending"
  | "allocated"
  | "running"
  | "retrying"
  | "completed"
  | "failed"
  | "skipped";

export interface TaskBrief {
  taskId: string;
  creatorPubkey: string;
  brief: string;
  budgetLamports: bigint;
  taskPda?: string;
  routerAgentPda?: string;
  orchestratorAgentPda?: string;
  timeoutSlots?: number;
}

export interface SubtaskNode {
  id: string;
  index: number;
  description: string;
  dependencies: string[];
  estimatedTier: Tier;
  estimatedBudgetLamports: bigint;
  maxRetryBudgetLamports: bigint;
  requiredCapabilities: string[];
  capabilityMask: bigint;
  agentClass: AgentClass;
  parentSubtaskId?: string;
}

export interface SubtaskTree {
  subtasks: SubtaskNode[];
}

export interface WorkerCandidate {
  agentPda: string;
  ownerPubkey?: string;
  reputationScore: number;
  pricePerTaskLamports: bigint;
  capabilities: string[];
  capabilityMask: bigint;
  isLocal: boolean;
}

export interface SubtaskExecutionRecord {
  subtask: SubtaskNode;
  status: SubtaskStatus;
  worker?: WorkerCandidate;
  optimizedQuery?: OptimizedQuery;
  routerDecision?: RouterDecision;
  judgeResult?: JudgeResult;
  resultContent?: string;
  resultHash?: string;
  allocateSignature?: string;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface TaskExecutionState {
  task: TaskBrief;
  tree: SubtaskTree;
  records: Record<string, SubtaskExecutionRecord>;
  status: OrchestratorStatus;
  releaseOrchestratorFeeSignature?: string;
}

export interface OrchestrationResult {
  taskId: string;
  status: OrchestratorStatus;
  subtaskCount: number;
  completedSubtasks: number;
  failedSubtasks: number;
  releaseOrchestratorFeeSignature?: string;
  records: SubtaskExecutionRecord[];
}

export interface DecompositionInput {
  task: TaskBrief;
  optimizedBrief: OptimizedQuery;
  orchestratorFeeLamports: bigint;
}

export interface ExecutionPlan {
  levels: SubtaskNode[][];
}

export interface OrchestratorConfig {
  minWorkerReputation: number;
  orchestratorFeeBps: number;
  defaultRouterAgentPda: string;
  defaultTaskPdaPrefix: string;
  defaultSubtaskBudgetLamports: bigint;
  defaultMaxRetryBudgetLamports: bigint;
}

export interface TimeoutPolicy {
  heartbeatMs: number;
  subtaskTimeoutMs: number;
}
