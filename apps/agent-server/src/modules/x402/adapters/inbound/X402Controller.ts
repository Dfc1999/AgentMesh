import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import {
  X402_CLIENT_USE_CASE,
  X402_PAYMENT_REPOSITORY,
  X402_SERVER_USE_CASE,
  X402_WALLET_USE_CASE,
} from "../../x402.module";
import { encodePayload } from "../../domain/paymentCodec";
import type { X402PaymentRequest, X402ProtectedResource } from "../../domain/types";
import type { IX402ClientUseCase } from "../../ports/inbound/IX402ClientUseCase";
import type { IX402ServerUseCase } from "../../ports/inbound/IX402ServerUseCase";
import type { IX402WalletUseCase } from "../../ports/inbound/IX402WalletUseCase";
import type { IPaymentRepository } from "../../ports/outbound/IPaymentRepository";

type ClientBody = Omit<X402PaymentRequest, "maxPriceLamports"> & {
  maxPriceLamports: string | number;
};

@Controller("x402")
export class X402Controller {
  constructor(
    @Inject(X402_CLIENT_USE_CASE)
    private readonly client: IX402ClientUseCase,
    @Inject(X402_SERVER_USE_CASE)
    private readonly server: IX402ServerUseCase,
    @Inject(X402_WALLET_USE_CASE)
    private readonly wallets: IX402WalletUseCase,
    @Inject(X402_PAYMENT_REPOSITORY)
    private readonly payments: IPaymentRepository,
  ) {}

  @Post("client/fetch")
  async fetchWithPayment(@Body() body: ClientBody) {
    return serialize(
      await this.client.fetchWithPayment({
        ...body,
        maxPriceLamports: BigInt(body.maxPriceLamports),
      }),
    );
  }

  @Post("wallets/:agentId/ensure")
  async ensureWallet(@Param("agentId") agentId: string, @Body() body: { keypairPath?: string }) {
    return serialize(await this.wallets.ensureReady(agentId, body.keypairPath));
  }

  @Get("payments")
  async listPayments() {
    return serialize(await this.payments.listPayments());
  }

  @Get("protected/results/:taskId")
  async protectedResult(
    @Param("taskId") taskId: string,
    @Headers("x-payment-proof") proofHeader?: string,
  ) {
    const resource: X402ProtectedResource = {
      path: `/x402/protected/results/${taskId}`,
      amountLamports: 25_000n,
      destination: "AgentMeshResultsTreasury",
      memo: `premium-result:${taskId}`,
    };
    const gate = await this.server.protect({ path: resource.path, proofHeader }, resource);

    if (!gate.allowed && gate.paymentPayload) {
      return {
        statusCode: 402,
        xPaymentPayload: encodePayload(gate.paymentPayload),
        reason: gate.reason,
      };
    }

    return {
      statusCode: 200,
      taskId,
      result: "Premium result access granted.",
    };
  }
}

function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
}
