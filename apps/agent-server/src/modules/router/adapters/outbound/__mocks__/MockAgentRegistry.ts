import type { RoutingRules } from "@agentmesh/shared-types";
import { DEFAULT_ROUTING_RULES } from "../../../domain/TierClassifier";
import type { IAgentRegistry, SkillTemplateMatch } from "../../../ports/outbound/IAgentRegistry";

export class MockAgentRegistry implements IAgentRegistry {
  constructor(
    private readonly routingRules: RoutingRules = DEFAULT_ROUTING_RULES,
    private readonly skillTemplates = new Map<string, SkillTemplateMatch>(),
  ) {}

  async getRoutingRules(): Promise<RoutingRules> {
    return this.routingRules;
  }

  async findSkillTemplate(skillId: string): Promise<SkillTemplateMatch | null> {
    return this.skillTemplates.get(skillId) ?? null;
  }
}
