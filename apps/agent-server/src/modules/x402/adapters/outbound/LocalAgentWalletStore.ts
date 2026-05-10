import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import type { AgentWallet } from "../../domain/types";
import type { IAgentWalletStore } from "../../ports/outbound/IAgentWalletStore";

export class LocalAgentWalletStore implements IAgentWalletStore {
  private readonly wallets = new Map<string, AgentWallet>();

  async getOrCreate(agentId: string, keypairPath?: string): Promise<AgentWallet> {
    const existing = this.wallets.get(agentId);
    if (existing) {
      return existing;
    }

    const resolvedPath = keypairPath ?? join(homedir(), ".agentmesh", "keys", `${agentId}.json`);
    const secret = [...randomBytes(64)];
    await mkdir(dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, JSON.stringify(secret), { encoding: "utf8", flag: "w" });
    const wallet: AgentWallet = {
      agentId,
      keypairPath: resolvedPath,
      publicKey: createHash("sha256").update(secret.join(",")).digest("hex").slice(0, 32),
      balanceLamports: 0n,
    };
    this.wallets.set(agentId, wallet);
    return wallet;
  }

  async updateBalance(agentId: string, balanceLamports: bigint): Promise<void> {
    const wallet = this.wallets.get(agentId);
    if (wallet) {
      wallet.balanceLamports = balanceLamports;
    }
  }
}
