export interface X402FetchResult {
  url: string;
  status: number;
  body: string;
  paymentSignature?: string;
}

export interface IX402Client {
  fetch(
    url: string,
    walletKeypairPath?: string,
    context?: { agentId?: string; subtaskId?: string; maxPriceLamports?: bigint },
  ): Promise<X402FetchResult>;
}
