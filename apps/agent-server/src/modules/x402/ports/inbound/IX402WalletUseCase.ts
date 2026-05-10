import type { AgentWallet } from "../../domain/types";

export interface IX402WalletUseCase {
  ensureReady(agentId: string, keypairPath?: string): Promise<AgentWallet>;
}
