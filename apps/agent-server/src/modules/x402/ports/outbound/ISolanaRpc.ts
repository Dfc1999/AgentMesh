import type { X402PaymentPayload } from "../../domain/types";

export interface ISolanaRpc {
  sendPayment(input: {
    from: string;
    keypairPath: string;
    payload: X402PaymentPayload;
  }): Promise<string>;
  confirmTransaction(signature: string, timeoutMs: number): Promise<boolean>;
  verifyPayment(signature: string, payload: X402PaymentPayload): Promise<boolean>;
  getBalance(publicKey: string): Promise<bigint>;
  requestAirdrop?(publicKey: string, lamports: bigint): Promise<string>;
}
