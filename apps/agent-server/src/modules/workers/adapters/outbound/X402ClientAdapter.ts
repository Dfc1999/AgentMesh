import type { IX402ClientUseCase } from "../../../x402";
import type { IX402Client, X402FetchResult } from "../../ports/outbound/IX402Client";

export class X402ClientAdapter implements IX402Client {
  constructor(private readonly client: IX402ClientUseCase) {}

  async fetch(
    url: string,
    walletKeypairPath?: string,
    context: { agentId?: string; subtaskId?: string; maxPriceLamports?: bigint } = {},
  ): Promise<X402FetchResult> {
    const result = await this.client.fetchWithPayment({
      url,
      method: "GET",
      maxPriceLamports: context.maxPriceLamports ?? 100_000n,
      agentId: context.agentId ?? "researcher",
      walletKeypairPath,
      subtaskId: context.subtaskId,
    });

    return {
      url,
      status: result.responseStatus,
      body: result.responseBody ?? "",
      paymentSignature: result.signature,
    };
  }
}
