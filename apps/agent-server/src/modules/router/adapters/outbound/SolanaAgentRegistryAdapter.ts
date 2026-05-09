import type { RoutingRules } from "@agentmesh/shared-types";
import { DEFAULT_ROUTING_RULES } from "../../domain/TierClassifier";
import type { IAgentRegistry } from "../../ports/outbound/IAgentRegistry";

export class SolanaAgentRegistryAdapter implements IAgentRegistry {
  async getRoutingRules(): Promise<RoutingRules> {
    return DEFAULT_ROUTING_RULES;
  }
}
