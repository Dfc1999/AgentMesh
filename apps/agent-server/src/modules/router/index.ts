export { RouterModule, ROUTER_USE_CASE } from "./router.module";
export { RouterService } from "./domain/RouterService";
export { DEFAULT_ROUTING_RULES, TierClassifier } from "./domain/TierClassifier";
export type { EscrowContext, RouterClassification, TierResolution } from "./domain/types";
export type { IRouterUseCase } from "./ports/inbound/IRouterUseCase";
export type { IAgentRegistry } from "./ports/outbound/IAgentRegistry";
export type { IRouterLlm } from "./ports/outbound/IRouterLlm";
export type { ITaskEscrow } from "./ports/outbound/ITaskEscrow";
export type {
  ModelId,
  RouterDecision,
  RouterWarning,
  RoutingRules,
  Tier,
} from "@agentmesh/shared-types";
