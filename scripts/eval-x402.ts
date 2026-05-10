import { encodePayload } from "../apps/agent-server/src/modules/x402/domain/paymentCodec";
import type { X402PaymentPayload } from "../apps/agent-server/src/modules/x402/domain/types";
import { X402ClientService } from "../apps/agent-server/src/modules/x402/domain/X402ClientService";
import { X402ServerService } from "../apps/agent-server/src/modules/x402/domain/X402ServerService";
import { X402WalletService } from "../apps/agent-server/src/modules/x402/domain/X402WalletService";
import { InMemoryPaymentRepository } from "../apps/agent-server/src/modules/x402/adapters/outbound/InMemoryPaymentRepository";
import { InMemoryProofCacheAdapter } from "../apps/agent-server/src/modules/x402/adapters/outbound/InMemoryProofCacheAdapter";
import { LocalAgentWalletStore } from "../apps/agent-server/src/modules/x402/adapters/outbound/LocalAgentWalletStore";
import { SimulatedSolanaRpcAdapter } from "../apps/agent-server/src/modules/x402/adapters/outbound/SimulatedSolanaRpcAdapter";
import type {
  HttpRequestLike,
  HttpResponseLike,
  IHttpClient,
} from "../apps/agent-server/src/modules/x402/ports/outbound/IHttpClient";

async function main() {
  const payload: X402PaymentPayload = {
    amountLamports: 25_000n,
    destination: "ApiTreasuryEval",
    network: "solana-devnet",
    memo: "eval-paid-api",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  const http = new EvalPaidHttp(payload);
  const solana = new SimulatedSolanaRpcAdapter();
  const payments = new InMemoryPaymentRepository();
  const proofCache = new InMemoryProofCacheAdapter();
  const wallets = new X402WalletService(new LocalAgentWalletStore(), solana, "devnet");
  const client = new X402ClientService(http, solana, payments, wallets);
  const server = new X402ServerService(solana, proofCache);

  const paid = await client.fetchWithPayment({
    url: "https://paid.example.test/resource",
    method: "GET",
    maxPriceLamports: 50_000n,
    agentId: "eval-agent",
    subtaskId: "eval-subtask",
  });
  const tooExpensive = await client.fetchWithPayment({
    url: "https://paid.example.test/resource",
    method: "GET",
    maxPriceLamports: 1n,
    agentId: "eval-agent",
  });
  const firstGate = await server.protect(
    {
      path: "/premium",
      proofHeader: paid.proof
        ? Buffer.from(JSON.stringify(paid.proof)).toString("base64url")
        : undefined,
    },
    {
      path: "/premium",
      amountLamports: payload.amountLamports,
      destination: payload.destination,
      memo: payload.memo,
      expiresAt: payload.expiresAt,
    },
  );
  const secondGate = await server.protect(
    {
      path: "/premium",
      proofHeader: paid.proof
        ? Buffer.from(JSON.stringify(paid.proof)).toString("base64url")
        : undefined,
    },
    {
      path: "/premium",
      amountLamports: payload.amountLamports,
      destination: payload.destination,
      memo: payload.memo,
      expiresAt: payload.expiresAt,
    },
  );

  console.table([
    {
      case: "paid request",
      paid: paid.paid,
      status: paid.responseStatus,
      signature: paid.signature,
    },
    {
      case: "budget guard",
      paid: tooExpensive.paid,
      status: tooExpensive.responseStatus,
      signature: tooExpensive.signature ?? "",
    },
    {
      case: "server proof",
      paid: firstGate.allowed,
      status: firstGate.status,
      signature: paid.signature,
    },
    {
      case: "reuse proof",
      paid: secondGate.allowed,
      status: secondGate.status,
      signature: paid.signature,
    },
  ]);

  if (
    !paid.paid ||
    paid.responseStatus !== 200 ||
    tooExpensive.paid ||
    !firstGate.allowed ||
    secondGate.allowed
  ) {
    throw new Error("x402 eval failed.");
  }
}

class EvalPaidHttp implements IHttpClient {
  constructor(private readonly payload: X402PaymentPayload) {}

  async request(input: HttpRequestLike): Promise<HttpResponseLike> {
    if (!input.headers["X-Payment-Proof"]) {
      return {
        status: 402,
        headers: {
          "x-payment-payload": encodePayload(this.payload),
        },
        body: "Payment required.",
      };
    }

    return {
      status: 200,
      headers: {},
      body: "Paid content.",
    };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
