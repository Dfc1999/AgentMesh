import {
  AGENT_REGISTRY_IDL,
  AGENT_REGISTRY_PROGRAM_ID,
  REPUTATION_LEDGER_IDL,
  REPUTATION_LEDGER_PROGRAM_ID,
  type AgentRegistry,
  type RegisterAgentParams,
  type ReputationLedger,
  type Tier,
} from "@agentmesh/idl";
import type { ModelId, RoutingRules } from "@agentmesh/shared-types";

export interface ProgramLike<TIdl> {
  idl: TIdl;
  programId: string;
  provider: unknown;
}

export type ProgramFactory = <TIdl>(
  idl: TIdl,
  programId: string,
  provider: unknown,
) => ProgramLike<TIdl>;

export interface AgentMeshPrograms {
  agentRegistry: ProgramLike<AgentRegistry>;
  reputationLedger: ProgramLike<ReputationLedger>;
}

export const defaultProgramFactory: ProgramFactory = (idl, programId, provider) => ({
  idl,
  programId,
  provider,
});

export function createAgentMeshPrograms(
  provider: unknown,
  factory: ProgramFactory = defaultProgramFactory,
): AgentMeshPrograms {
  return {
    agentRegistry: factory(AGENT_REGISTRY_IDL, AGENT_REGISTRY_PROGRAM_ID, provider),
    reputationLedger: factory(REPUTATION_LEDGER_IDL, REPUTATION_LEDGER_PROGRAM_ID, provider),
  };
}

export interface PendingTransaction {
  signature: string;
}

export interface AgentRegistryClient {
  registerAgent(params: RegisterAgentParams): Promise<PendingTransaction>;
  getAgentsByCapability(capabilityMask: bigint): Promise<string[]>;
  getAgentCandidatesByCapability?(
    capabilityMask: bigint,
    minReputation: number,
  ): Promise<
    Array<{
      agentPda: string;
      ownerPubkey?: string;
      reputationScore: number;
      pricePerTaskLamports: bigint;
      capabilities: string[];
      capabilityMask: bigint;
      isLocal: boolean;
    }>
  >;
  getRoutingRules(agentPda: string): Promise<RoutingRules>;
}

export interface ReputationLedgerClient {
  recordOutcome(input: {
    agent: string;
    task: string;
    success: boolean;
    score: number;
    tierUsed: Tier;
  }): Promise<PendingTransaction>;
  recordTierAccuracy(input: {
    routerAgent: string;
    predictedTier: Tier;
    actualTierNeeded: Tier;
    retryHappened: boolean;
  }): Promise<PendingTransaction>;
  queryScore(agent: string): Promise<number>;
}

export interface DeclareTierInput {
  subtaskPda: string;
  tier: Tier;
  modelId: ModelId;
  budgetSliceLamports: bigint;
}

export interface RetrySubtaskInput {
  subtaskPda: string;
  newTier: Tier;
  newWorker?: string;
}

export interface AllocateSubtaskInput {
  taskPda: string;
  subtaskPda: string;
  index: number;
  parentSubtaskPda?: string;
  budgetLamports: bigint;
  maxRetryBudgetLamports: bigint;
  estimatedTier: Tier;
}

export interface TaskEscrowClient {
  allocateSubtask(input: AllocateSubtaskInput): Promise<PendingTransaction>;
  declareTier(input: DeclareTierInput): Promise<PendingTransaction>;
  submitResult(input: { subtaskPda: string; resultHash: string }): Promise<PendingTransaction>;
  retrySubtask(input: RetrySubtaskInput): Promise<PendingTransaction>;
  releaseOrchestratorFee(taskPda: string): Promise<PendingTransaction>;
}

export interface ConsensusClient {
  submitValidation(input: {
    subtaskPda: string;
    approved: boolean;
    justificationHash: Buffer;
  }): Promise<PendingTransaction>;
  initializeConsensus(input: {
    subtaskPda: string;
    requiredSigs: number;
    validators: string[];
  }): Promise<PendingTransaction>;
}

export interface SolanaProgramClients {
  agentRegistry: AgentRegistryClient;
  consensus: ConsensusClient;
  reputationLedger: ReputationLedgerClient;
  taskEscrow: TaskEscrowClient;
}

export function createMockSolanaProgramClients(): SolanaProgramClients {
  return {
    agentRegistry: {
      registerAgent: async () => mockSignature("registerAgent"),
      getAgentsByCapability: async () => ["LocalWorkerResearch", "LocalWorkerAnalysis"],
      getAgentCandidatesByCapability: async (capabilityMask) => [
        {
          agentPda: "LocalWorkerResearch",
          reputationScore: 40,
          pricePerTaskLamports: 500_000n,
          capabilities: ["research", "analysis", "summarization"],
          capabilityMask,
          isLocal: true,
        },
        {
          agentPda: "LocalWorkerValidator",
          reputationScore: 35,
          pricePerTaskLamports: 450_000n,
          capabilities: ["validation", "analysis"],
          capabilityMask,
          isLocal: true,
        },
      ],
      getRoutingRules: async () => ({
        simpleMaxTokens: 50,
        simpleMaxComplexity: 0.3,
        mediumMaxTokens: 500,
        mediumMaxComplexity: 0.7,
        minReputationScore: -50,
        maxRetries: 1,
      }),
    },
    consensus: {
      submitValidation: async () => mockSignature("submitValidation"),
      initializeConsensus: async () => mockSignature("initializeConsensus"),
    },
    reputationLedger: {
      recordOutcome: async () => mockSignature("recordOutcome"),
      recordTierAccuracy: async () => mockSignature("recordTierAccuracy"),
      queryScore: async () => 0,
    },
    taskEscrow: {
      allocateSubtask: async () => mockSignature("allocateSubtask"),
      declareTier: async () => mockSignature("declareTier"),
      submitResult: async () => mockSignature("submitResult"),
      retrySubtask: async () => mockSignature("retrySubtask"),
      releaseOrchestratorFee: async () => mockSignature("releaseOrchestratorFee"),
    },
  };
}

function mockSignature(prefix: string): PendingTransaction {
  return {
    signature: `mockSig_${prefix}_${Math.random().toString(36).slice(2)}`,
  };
}
