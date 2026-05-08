export interface X402PaymentRequest {
  url: string;
  method: "GET" | "POST";
  maxPriceLamports: bigint;
}

export interface X402PaymentResult {
  paid: boolean;
  signature?: string;
  responseStatus: number;
}
