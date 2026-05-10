import { decodeProof, encodePayload, payloadHash } from "./paymentCodec";
import type { X402ProtectedResource, X402ServerRequest, X402ServerResult } from "./types";
import type { IProofCache } from "../ports/outbound/IProofCache";
import type { ISolanaRpc } from "../ports/outbound/ISolanaRpc";

const PROOF_TTL_SECONDS = 300;

export class X402ServerService {
  constructor(
    private readonly solana: ISolanaRpc,
    private readonly proofCache: IProofCache,
  ) {}

  async protect(
    request: X402ServerRequest,
    resource: X402ProtectedResource,
  ): Promise<X402ServerResult> {
    const payload = {
      amountLamports: resource.amountLamports,
      destination: resource.destination,
      network: "solana-devnet" as const,
      memo: resource.memo,
      expiresAt: resource.expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
    };

    if (!request.proofHeader) {
      return {
        allowed: false,
        status: 402,
        paymentPayload: payload,
        reason: encodePayload(payload),
      };
    }

    const proof = decodeProof(request.proofHeader);
    if (await this.proofCache.isAlreadyUsed(proof.txSignature)) {
      return {
        allowed: false,
        status: 402,
        paymentPayload: payload,
        reason: "Payment proof was already used.",
      };
    }

    if (proof.payloadHash !== payloadHash(payload)) {
      return {
        allowed: false,
        status: 402,
        paymentPayload: payload,
        reason: "Payment proof payload hash mismatch.",
      };
    }

    const verified = await this.solana.verifyPayment(proof.txSignature, payload);
    if (!verified) {
      return {
        allowed: false,
        status: 402,
        paymentPayload: payload,
        reason: "Payment transaction could not be verified.",
      };
    }

    await this.proofCache.markUsed(proof.txSignature, PROOF_TTL_SECONDS);
    return { allowed: true, status: 200 };
  }
}
