import { createHash, randomUUID } from "node:crypto";
import type { X402PaymentPayload } from "../../domain/types";
import { payloadHash } from "../../domain/paymentCodec";
import type { ISolanaRpc } from "../../ports/outbound/ISolanaRpc";

interface PaymentTx {
  from: string;
  payload: X402PaymentPayload;
}

export class SimulatedSolanaRpcAdapter implements ISolanaRpc {
  private readonly balances = new Map<string, bigint>();
  private readonly payments = new Map<string, PaymentTx>();

  async sendPayment(input: {
    from: string;
    keypairPath: string;
    payload: X402PaymentPayload;
  }): Promise<string> {
    const balance = await this.getBalance(input.from);
    if (balance < input.payload.amountLamports) {
      throw new Error("Insufficient agent wallet balance for x402 payment.");
    }

    this.balances.set(input.from, balance - input.payload.amountLamports);
    const signature = `x402_${createHash("sha256")
      .update(input.from)
      .update(input.keypairPath)
      .update(payloadHash(input.payload))
      .update(randomUUID())
      .digest("hex")
      .slice(0, 32)}`;
    this.payments.set(signature, { from: input.from, payload: input.payload });
    return signature;
  }

  async confirmTransaction(signature: string): Promise<boolean> {
    return this.payments.has(signature);
  }

  async verifyPayment(signature: string, payload: X402PaymentPayload): Promise<boolean> {
    const tx = this.payments.get(signature);
    return Boolean(tx && payloadHash(tx.payload) === payloadHash(payload));
  }

  async getBalance(publicKey: string): Promise<bigint> {
    return this.balances.get(publicKey) ?? 0n;
  }

  async requestAirdrop(publicKey: string, lamports: bigint): Promise<string> {
    this.balances.set(publicKey, (this.balances.get(publicKey) ?? 0n) + lamports);
    return `airdrop_${publicKey}_${lamports}`;
  }
}
