export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: bigint;
  outAmount: bigint;
  priceImpactPct: number;
  routePlan: string[];
}

export interface SwapQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps: number;
}

export interface IJupiterClient {
  getSwapQuote(params: SwapQuoteRequest): Promise<SwapQuote>;
  simulateSwap?(quote: SwapQuote): Promise<{ ok: boolean; reason?: string }>;
}
