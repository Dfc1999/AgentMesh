import type { OptimizedQuery, RouterDecision } from "@agentmesh/shared-types";
import type { EscrowContext } from "../../domain/types";

export interface IRouterUseCase {
  classify(query: OptimizedQuery, escrowCtx: EscrowContext): Promise<RouterDecision>;
}
