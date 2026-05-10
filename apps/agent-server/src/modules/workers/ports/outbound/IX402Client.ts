export interface X402FetchResult {
  url: string;
  status: number;
  body: string;
  paymentSignature?: string;
}

export interface IX402Client {
  fetch(url: string, walletKeypairPath?: string): Promise<X402FetchResult>;
}
