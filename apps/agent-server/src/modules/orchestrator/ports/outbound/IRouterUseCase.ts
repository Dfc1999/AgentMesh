import type { OptimizedQuery, RouterDecision } from "@agentmesh/shared-types";

export interface EscrowContext {
  routerAgentPda: string;
  subtaskPda: string;
  remainingBudgetLamports: bigint;
  maxRetryBudgetLamports?: bigint;
}

export interface IRouterUseCase {
  classify(query: OptimizedQuery, escrowCtx: EscrowContext): Promise<RouterDecision>;
}
