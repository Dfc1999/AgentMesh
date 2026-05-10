import { createHash } from "node:crypto";
import type {
  AgentInfo,
  AgentReputation,
  CancelTaskResult,
  QueryAgentsFilter,
  RegisterAgentInput,
} from "./types";

export class SdkGatewayService {
  private readonly agents = new Map<string, AgentInfo>();

  constructor() {
    for (const agent of defaultAgents()) {
      this.agents.set(agent.agentId, agent);
    }
  }

  registerAgent(input: RegisterAgentInput): AgentInfo {
    const agentId = input.agentId ?? deterministicAgentId(input.ownerPubkey, input.name);
    const existing = this.agents.get(agentId);
    const agent: AgentInfo = {
      agentId,
      name: input.name,
      ownerPubkey: input.ownerPubkey,
      agentClass: input.agentClass,
      capabilities: unique(input.capabilities),
      reputationScore: existing?.reputationScore ?? 0,
      completedTasks: existing?.completedTasks ?? 0,
      failedTasks: existing?.failedTasks ?? 0,
      pricePerTaskLamports: input.pricePerTaskLamports,
      minTier: input.minTier,
      endpoint: input.endpoint,
      registeredAt: existing?.registeredAt ?? new Date().toISOString(),
      metadata: input.metadata,
    };
    this.agents.set(agentId, agent);
    return agent;
  }

  queryAgents(filter: QueryAgentsFilter): AgentInfo[] {
    return [...this.agents.values()]
      .filter((agent) => {
        const hasCapabilities = filter.capabilities.every((capability) =>
          agent.capabilities.includes(capability),
        );
        const matchesClass = !filter.agentClass || agent.agentClass === filter.agentClass;
        const matchesReputation =
          filter.minReputationScore === undefined ||
          agent.reputationScore >= filter.minReputationScore;
        const matchesPrice =
          filter.maxPricePerTaskLamports === undefined ||
          agent.pricePerTaskLamports <= filter.maxPricePerTaskLamports;
        return hasCapabilities && matchesClass && matchesReputation && matchesPrice;
      })
      .sort((left, right) => right.reputationScore - left.reputationScore);
  }

  getAgentReputation(agentId: string): AgentReputation {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        agentId,
        reputationScore: 0,
        completedTasks: 0,
        failedTasks: 0,
        successRate: 0,
        updatedAt: new Date().toISOString(),
      };
    }
    const total = agent.completedTasks + agent.failedTasks;
    return {
      agentId,
      reputationScore: agent.reputationScore,
      completedTasks: agent.completedTasks,
      failedTasks: agent.failedTasks,
      successRate: total === 0 ? 0 : agent.completedTasks / total,
      updatedAt: new Date().toISOString(),
    };
  }

  cancelTask(taskId: string): CancelTaskResult {
    return {
      taskId,
      cancelled: false,
      reason:
        "Task cancellation is exposed in the SDK contract, but backend cancellation needs Task Escrow cancel integration.",
    };
  }
}

function deterministicAgentId(ownerPubkey: string, name: string): string {
  return `agent-${createHash("sha256").update(`${ownerPubkey}:${name}`).digest("hex").slice(0, 16)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function defaultAgents(): AgentInfo[] {
  const registeredAt = new Date(0).toISOString();
  return [
    {
      agentId: "ResearcherAgentLocal",
      name: "Local Researcher",
      ownerPubkey: "AgentMeshLocalOperator",
      agentClass: "worker",
      capabilities: ["research", "web_search", "summarization"],
      reputationScore: 0.84,
      completedTasks: 24,
      failedTasks: 2,
      pricePerTaskLamports: 250_000n,
      minTier: "simple",
      registeredAt,
    },
    {
      agentId: "AnalyzerAgentLocal",
      name: "Local Analyzer",
      ownerPubkey: "AgentMeshLocalOperator",
      agentClass: "worker",
      capabilities: ["analysis", "data_analysis"],
      reputationScore: 0.86,
      completedTasks: 19,
      failedTasks: 1,
      pricePerTaskLamports: 300_000n,
      minTier: "medium",
      registeredAt,
    },
    {
      agentId: "ExecutorAgentLocal",
      name: "Local Executor",
      ownerPubkey: "AgentMeshLocalOperator",
      agentClass: "worker",
      capabilities: ["execution", "defi"],
      reputationScore: 0.82,
      completedTasks: 12,
      failedTasks: 2,
      pricePerTaskLamports: 350_000n,
      minTier: "medium",
      registeredAt,
    },
    {
      agentId: "ValidatorAgentLocal",
      name: "Local Validator",
      ownerPubkey: "AgentMeshLocalOperator",
      agentClass: "validator",
      capabilities: ["validation", "quality_review"],
      reputationScore: 0.88,
      completedTasks: 31,
      failedTasks: 1,
      pricePerTaskLamports: 200_000n,
      minTier: "simple",
      registeredAt,
    },
  ];
}
