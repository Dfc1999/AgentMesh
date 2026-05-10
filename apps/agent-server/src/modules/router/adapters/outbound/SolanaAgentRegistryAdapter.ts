import type { RoutingRules } from "@agentmesh/shared-types";
import type { AgentRegistryClient } from "../../../../shared/solana/programs";
import type { IAgentRegistry } from "../../ports/outbound/IAgentRegistry";

export class SolanaAgentRegistryAdapter implements IAgentRegistry {
  constructor(private readonly agentRegistry: AgentRegistryClient) {}

  async getRoutingRules(agentPda: string): Promise<RoutingRules> {
    return this.agentRegistry.getRoutingRules(agentPda);
  }
}
