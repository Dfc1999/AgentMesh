import type { AgentWallet } from "../../domain/types";

export interface IAgentWalletStore {
  getOrCreate(agentId: string, keypairPath?: string): Promise<AgentWallet>;
  updateBalance(agentId: string, balanceLamports: bigint): Promise<void>;
}
