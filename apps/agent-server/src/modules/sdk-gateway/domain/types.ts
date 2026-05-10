import type { AgentClass, Tier } from "@agentmesh/shared-types";

export interface RegisterAgentInput {
  agentId?: string;
  name: string;
  ownerPubkey: string;
  agentClass: AgentClass;
  capabilities: string[];
  pricePerTaskLamports: bigint;
  minTier?: Tier;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentInfo {
  agentId: string;
  name: string;
  ownerPubkey: string;
  agentClass: AgentClass;
  capabilities: string[];
  reputationScore: number;
  completedTasks: number;
  failedTasks: number;
  pricePerTaskLamports: bigint;
  minTier?: Tier;
  endpoint?: string;
  registeredAt: string;
  metadata?: Record<string, unknown>;
}

export interface QueryAgentsFilter {
  capabilities: string[];
  agentClass?: AgentClass;
  minReputationScore?: number;
  maxPricePerTaskLamports?: bigint;
}

export interface AgentReputation {
  agentId: string;
  reputationScore: number;
  completedTasks: number;
  failedTasks: number;
  successRate: number;
  updatedAt: string;
}

export interface CancelTaskResult {
  taskId: string;
  cancelled: boolean;
  reason?: string;
}
