import { randomUUID } from "node:crypto";
import { decodePayload, encodeProof, payloadHash } from "./paymentCodec";
import type {
  MicropaymentRecord,
  X402PaymentProof,
  X402PaymentRequest,
  X402PaymentResult,
} from "./types";
import type { IHttpClient } from "../ports/outbound/IHttpClient";
import type { IPaymentRepository } from "../ports/outbound/IPaymentRepository";
import type { ISolanaRpc } from "../ports/outbound/ISolanaRpc";
import type { X402WalletService } from "./X402WalletService";

const PAYMENT_PAYLOAD_HEADER = "x-payment-payload";
const PAYMENT_PROOF_HEADER = "X-Payment-Proof";
const CONFIRM_TIMEOUT_MS = 2_000;

export class X402ClientService {
  constructor(
    private readonly http: IHttpClient,
    private readonly solana: ISolanaRpc,
    private readonly payments: IPaymentRepository,
    private readonly wallets: X402WalletService,
  ) {}

  async fetchWithPayment(request: X402PaymentRequest): Promise<X402PaymentResult> {
    const method = request.method ?? "GET";
    const first = await this.http.request({
      url: request.url,
      method,
      headers: request.headers ?? {},
      body: request.body,
    });

    if (first.status !== 402) {
      return {
        paid: false,
        responseStatus: first.status,
        responseBody: first.body,
      };
    }

    const payloadHeader =
      first.headers[PAYMENT_PAYLOAD_HEADER] ?? first.headers["X-Payment-Payload"];
    if (!payloadHeader) {
      throw new Error("x402 response is missing X-Payment-Payload header.");
    }

    const payload = decodePayload(payloadHeader);
    if (payload.amountLamports > request.maxPriceLamports) {
      return {
        paid: false,
        responseStatus: 402,
        responseBody: "Requested x402 price exceeds maxPriceLamports.",
        paymentPayload: payload,
      };
    }

    const wallet = await this.wallets.ensureReady(request.agentId, request.walletKeypairPath);
    const signature = await this.solana.sendPayment({
      from: wallet.publicKey,
      keypairPath: wallet.keypairPath,
      payload,
    });
    const confirmed = await this.solana.confirmTransaction(signature, CONFIRM_TIMEOUT_MS);
    if (!confirmed) {
      throw new Error(
        `x402 payment ${signature} was not confirmed within ${CONFIRM_TIMEOUT_MS}ms.`,
      );
    }

    const proof: X402PaymentProof = {
      txSignature: signature,
      payer: wallet.publicKey,
      payloadHash: payloadHash(payload),
      paidAt: new Date().toISOString(),
    };
    const second = await this.http.request({
      url: request.url,
      method,
      headers: {
        ...(request.headers ?? {}),
        [PAYMENT_PROOF_HEADER]: encodeProof(proof),
      },
      body: request.body,
    });
    await this.payments.recordPayment(
      toRecord(request, payload.destination, payload.amountLamports, signature),
    );

    return {
      paid: true,
      signature,
      responseStatus: second.status,
      responseBody: second.body,
      paymentPayload: payload,
      proof,
    };
  }
}

function toRecord(
  request: X402PaymentRequest,
  destination: string,
  amountLamports: bigint,
  signature: string,
): MicropaymentRecord {
  return {
    id: randomUUID(),
    amountLamports,
    destination,
    apiUrl: request.url,
    subtaskId: request.subtaskId,
    agentId: request.agentId,
    signature,
    createdAt: new Date().toISOString(),
  };
}
