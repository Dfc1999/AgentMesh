import type { RoutingRules } from "@agentmesh/shared-types";

export interface SkillTemplateMatch {
  skillId: string;
  score: number;
  renderedTemplate: string;
}

export interface IAgentRegistry {
  getRoutingRules(agentPda: string): Promise<RoutingRules>;
  findSkillTemplate?(skillId: string): Promise<SkillTemplateMatch | null>;
}
