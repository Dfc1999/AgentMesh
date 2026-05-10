import { Module } from "@nestjs/common";
import { X402Controller } from "./adapters/inbound/X402Controller";
import { InMemoryPaymentRepository } from "./adapters/outbound/InMemoryPaymentRepository";
import { InMemoryProofCacheAdapter } from "./adapters/outbound/InMemoryProofCacheAdapter";
import { LocalAgentWalletStore } from "./adapters/outbound/LocalAgentWalletStore";
import { NativeHttpClientAdapter } from "./adapters/outbound/NativeHttpClientAdapter";
import { SimulatedSolanaRpcAdapter } from "./adapters/outbound/SimulatedSolanaRpcAdapter";
import { X402ClientService } from "./domain/X402ClientService";
import { X402ServerService } from "./domain/X402ServerService";
import { X402WalletService } from "./domain/X402WalletService";
import type { IAgentWalletStore } from "./ports/outbound/IAgentWalletStore";
import type { IHttpClient } from "./ports/outbound/IHttpClient";
import type { IPaymentRepository } from "./ports/outbound/IPaymentRepository";
import type { IProofCache } from "./ports/outbound/IProofCache";
import type { ISolanaRpc } from "./ports/outbound/ISolanaRpc";

export const X402_CLIENT_USE_CASE = Symbol("X402_CLIENT_USE_CASE");
export const X402_SERVER_USE_CASE = Symbol("X402_SERVER_USE_CASE");
export const X402_WALLET_USE_CASE = Symbol("X402_WALLET_USE_CASE");
export const X402_HTTP_CLIENT = Symbol("X402_HTTP_CLIENT");
export const X402_SOLANA_RPC = Symbol("X402_SOLANA_RPC");
export const X402_PROOF_CACHE = Symbol("X402_PROOF_CACHE");
export const X402_PAYMENT_REPOSITORY = Symbol("X402_PAYMENT_REPOSITORY");
export const X402_AGENT_WALLET_STORE = Symbol("X402_AGENT_WALLET_STORE");

@Module({
  controllers: [X402Controller],
  providers: [
    {
      provide: X402_HTTP_CLIENT,
      useFactory: () => new NativeHttpClientAdapter(),
    },
    {
      provide: X402_SOLANA_RPC,
      useFactory: () => new SimulatedSolanaRpcAdapter(),
    },
    {
      provide: X402_PROOF_CACHE,
      useFactory: () => new InMemoryProofCacheAdapter(),
    },
    {
      provide: X402_PAYMENT_REPOSITORY,
      useFactory: () => new InMemoryPaymentRepository(),
    },
    {
      provide: X402_AGENT_WALLET_STORE,
      useFactory: () => new LocalAgentWalletStore(),
    },
    {
      provide: X402_WALLET_USE_CASE,
      inject: [X402_AGENT_WALLET_STORE, X402_SOLANA_RPC],
      useFactory: (walletStore: IAgentWalletStore, solana: ISolanaRpc) =>
        new X402WalletService(walletStore, solana, "devnet"),
    },
    {
      provide: X402_CLIENT_USE_CASE,
      inject: [X402_HTTP_CLIENT, X402_SOLANA_RPC, X402_PAYMENT_REPOSITORY, X402_WALLET_USE_CASE],
      useFactory: (
        http: IHttpClient,
        solana: ISolanaRpc,
        payments: IPaymentRepository,
        wallets: X402WalletService,
      ) => new X402ClientService(http, solana, payments, wallets),
    },
    {
      provide: X402_SERVER_USE_CASE,
      inject: [X402_SOLANA_RPC, X402_PROOF_CACHE],
      useFactory: (solana: ISolanaRpc, proofCache: IProofCache) =>
        new X402ServerService(solana, proofCache),
    },
  ],
  exports: [X402_CLIENT_USE_CASE, X402_SERVER_USE_CASE, X402_WALLET_USE_CASE],
})
export class X402Module {}
