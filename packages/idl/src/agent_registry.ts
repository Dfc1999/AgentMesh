export type AgentRegistry = {
  version: "0.1.0";
  name: "agent_registry";
  instructions: [
    "register_agent",
    "update_capabilities",
    "set_routing_rules",
    "deactivate_agent",
    "slash_reputation",
    "get_agents_by_capability",
  ];
  accounts: {
    agentAccount: AgentAccount;
  };
  types: {
    registerAgentParams: RegisterAgentParams;
    routingRules: RoutingRules;
    agentClass: AgentClass;
    slashReason: SlashReason;
  };
};

export type AgentClass = "worker" | "router" | "judge" | "optimizer" | "validator";

export type SlashReason =
  | "invalid_validation"
  | "missed_deadline"
  | "fraudulent_result"
  | "dispute_vetoed"
  | "manual_review";

export interface RoutingRules {
  simpleMaxTokens: number;
  simpleMaxComplexityBps: number;
  mediumMaxTokens: number;
  mediumMaxComplexityBps: number;
  minReputationScore: number;
  maxRetries: number;
}

export interface RegisterAgentParams {
  capabilities: bigint;
  supportedTiers: number;
  pricePerTask: bigint;
  routingRules: RoutingRules;
  agentClass: AgentClass;
}

export interface AgentAccount {
  owner: string;
  capabilities: bigint;
  supportedTiers: number;
  pricePerTask: bigint;
  reputationScore: number;
  totalTasks: number;
  successfulTasks: number;
  routingRules: RoutingRules;
  agentClass: AgentClass;
  isActive: boolean;
  registeredAt: bigint;
  bump: number;
}

export const AGENT_REGISTRY_PROGRAM_ID = "11111111111111111111111111111111";

export const AGENT_REGISTRY_IDL: AgentRegistry = {
  version: "0.1.0",
  name: "agent_registry",
  instructions: [
    "register_agent",
    "update_capabilities",
    "set_routing_rules",
    "deactivate_agent",
    "slash_reputation",
    "get_agents_by_capability",
  ],
  accounts: {
    agentAccount: {
      owner: "",
      capabilities: 0n,
      supportedTiers: 0,
      pricePerTask: 0n,
      reputationScore: 0,
      totalTasks: 0,
      successfulTasks: 0,
      routingRules: {
        simpleMaxTokens: 0,
        simpleMaxComplexityBps: 0,
        mediumMaxTokens: 0,
        mediumMaxComplexityBps: 0,
        minReputationScore: 0,
        maxRetries: 0,
      },
      agentClass: "worker",
      isActive: false,
      registeredAt: 0n,
      bump: 0,
    },
  },
  types: {
    registerAgentParams: {
      capabilities: 0n,
      supportedTiers: 0,
      pricePerTask: 0n,
      routingRules: {
        simpleMaxTokens: 0,
        simpleMaxComplexityBps: 0,
        mediumMaxTokens: 0,
        mediumMaxComplexityBps: 0,
        minReputationScore: 0,
        maxRetries: 0,
      },
      agentClass: "worker",
    },
    routingRules: {
      simpleMaxTokens: 0,
      simpleMaxComplexityBps: 0,
      mediumMaxTokens: 0,
      mediumMaxComplexityBps: 0,
      minReputationScore: 0,
      maxRetries: 0,
    },
    agentClass: "worker",
    slashReason: "manual_review",
  },
};

export const IDL = AGENT_REGISTRY_IDL;
