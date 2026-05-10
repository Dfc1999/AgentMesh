import type {
  IJupiterClient,
  SwapQuote,
  SwapQuoteRequest,
} from "../../ports/outbound/IJupiterClient";

export class JupiterSwapAdapter implements IJupiterClient {
  async getSwapQuote(params: SwapQuoteRequest): Promise<SwapQuote> {
    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inAmount: params.amount,
      outAmount: params.amount * 100n,
      priceImpactPct: 0.12,
      routePlan: ["simulated-jupiter-route"],
    };
  }

  async simulateSwap(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
