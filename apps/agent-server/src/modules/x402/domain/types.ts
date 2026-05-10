export type X402HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface X402PaymentRequest {
  url: string;
  method?: X402HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  maxPriceLamports: bigint;
  agentId: string;
  walletKeypairPath?: string;
  subtaskId?: string;
}

export interface X402PaymentPayload {
  amountLamports: bigint;
  destination: string;
  network: "solana-devnet" | "solana-mainnet";
  memo: string;
  expiresAt: string;
}

export interface X402PaymentProof {
  txSignature: string;
  payer: string;
  payloadHash: string;
  paidAt: string;
}

export interface X402PaymentResult {
  paid: boolean;
  signature?: string;
  responseStatus: number;
  responseBody?: string;
  paymentPayload?: X402PaymentPayload;
  proof?: X402PaymentProof;
}

export interface X402ProtectedResource {
  path: string;
  amountLamports: bigint;
  destination: string;
  memo: string;
  expiresAt?: string;
}

export interface X402ServerRequest {
  path: string;
  proofHeader?: string;
  agentId?: string;
}

export interface X402ServerResult {
  allowed: boolean;
  status: 200 | 402;
  paymentPayload?: X402PaymentPayload;
  reason?: string;
}

export interface AgentWallet {
  agentId: string;
  publicKey: string;
  keypairPath: string;
  balanceLamports: bigint;
  ownerPubkey?: string;
}

export interface MicropaymentRecord {
  id: string;
  amountLamports: bigint;
  destination: string;
  apiUrl: string;
  subtaskId?: string;
  agentId: string;
  signature: string;
  createdAt: string;
}
