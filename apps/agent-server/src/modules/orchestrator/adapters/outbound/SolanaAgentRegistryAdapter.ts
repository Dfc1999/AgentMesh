import type {
  AgentRegistryClient,
  ReputationLedgerClient,
} from "../../../../shared/solana/programs";
import type { WorkerCandidate } from "../../domain/types";
import type { IAgentRegistry } from "../../ports/outbound/IAgentRegistry";

export class SolanaAgentRegistryAdapter implements IAgentRegistry {
  constructor(
    private readonly agentRegistry: AgentRegistryClient,
    private readonly reputationLedger: ReputationLedgerClient,
  ) {}

  async getAgentsByCapability(
    capabilityMask: bigint,
    minReputation: number,
  ): Promise<WorkerCandidate[]> {
    if (this.agentRegistry.getAgentCandidatesByCapability) {
      return this.agentRegistry.getAgentCandidatesByCapability(capabilityMask, minReputation);
    }

    const agentPdas = await this.agentRegistry.getAgentsByCapability(capabilityMask);
    return Promise.all(
      agentPdas.map(async (agentPda) => ({
        agentPda,
        reputationScore: await this.reputationLedger.queryScore(agentPda),
        pricePerTaskLamports: 0n,
        capabilities: [],
        capabilityMask,
        isLocal: false,
      })),
    );
  }

  async registerOrchestrator(input: { capabilities: bigint; commissionBps: number }): Promise<string> {
    const tx = await this.agentRegistry.registerAgent({
      capabilities: input.capabilities,
      supportedTiers: 0b111,
      pricePerTask: BigInt(input.commissionBps),
      routingRules: {
        simpleMaxTokens: 50,
        simpleMaxComplexityBps: 3000,
        mediumMaxTokens: 500,
        mediumMaxComplexityBps: 7000,
        minReputationScore: -10,
        maxRetries: 1,
      },
      agentClass: "worker",
    });
    return tx.signature;
  }
}
