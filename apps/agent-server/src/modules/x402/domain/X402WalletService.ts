import type { AgentWallet } from "./types";
import type { IAgentWalletStore } from "../ports/outbound/IAgentWalletStore";
import type { ISolanaRpc } from "../ports/outbound/ISolanaRpc";

const LOW_BALANCE_LAMPORTS = 100_000_000n;
const AIRDROP_THRESHOLD_LAMPORTS = 50_000_000n;
const AIRDROP_AMOUNT_LAMPORTS = 500_000_000n;

export class X402WalletService {
  constructor(
    private readonly walletStore: IAgentWalletStore,
    private readonly solana: ISolanaRpc,
    private readonly network: "devnet" | "mainnet" = "devnet",
  ) {}

  async ensureReady(agentId: string, keypairPath?: string): Promise<AgentWallet> {
    const wallet = await this.walletStore.getOrCreate(agentId, keypairPath);
    const balance = await this.solana.getBalance(wallet.publicKey);
    await this.walletStore.updateBalance(agentId, balance);
    const current = { ...wallet, balanceLamports: balance };

    if (balance < LOW_BALANCE_LAMPORTS) {
      console.warn(
        JSON.stringify({
          module: "x402",
          event: "low_agent_balance",
          agent_id: agentId,
          balance_lamports: balance.toString(),
        }),
      );
    }

    if (
      this.network === "devnet" &&
      balance < AIRDROP_THRESHOLD_LAMPORTS &&
      this.solana.requestAirdrop
    ) {
      await this.solana.requestAirdrop(wallet.publicKey, AIRDROP_AMOUNT_LAMPORTS);
      const fundedBalance = await this.solana.getBalance(wallet.publicKey);
      await this.walletStore.updateBalance(agentId, fundedBalance);
      return { ...current, balanceLamports: fundedBalance };
    }

    return current;
  }
}
