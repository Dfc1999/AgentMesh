import { Module } from "@nestjs/common";
import { LLM_CLIENT_FACTORY } from "../../shared/llm/llm.module";
import type { LLMClientFactory } from "../../shared/llm/LLMClientFactory";
import {
  createMockSolanaProgramClients,
  type SolanaProgramClients,
} from "../../shared/solana/programs";
import { RouterLlmAdapter } from "./adapters/outbound/RouterLlmAdapter";
import { SolanaAgentRegistryAdapter } from "./adapters/outbound/SolanaAgentRegistryAdapter";
import { SolanaTaskEscrowAdapter } from "./adapters/outbound/SolanaTaskEscrowAdapter";
import { RouterService } from "./domain/RouterService";
import type { IAgentRegistry } from "./ports/outbound/IAgentRegistry";
import type { IRouterLlm } from "./ports/outbound/IRouterLlm";
import type { ITaskEscrow } from "./ports/outbound/ITaskEscrow";

export const ROUTER_USE_CASE = Symbol("ROUTER_USE_CASE");
export const ROUTER_LLM = Symbol("ROUTER_LLM");
export const ROUTER_AGENT_REGISTRY = Symbol("ROUTER_AGENT_REGISTRY");
export const ROUTER_TASK_ESCROW = Symbol("ROUTER_TASK_ESCROW");
export const ROUTER_SOLANA_CLIENTS = Symbol("ROUTER_SOLANA_CLIENTS");

@Module({
  providers: [
    {
      provide: ROUTER_LLM,
      inject: [LLM_CLIENT_FACTORY],
      useFactory: (llmFactory: LLMClientFactory) => new RouterLlmAdapter(llmFactory),
    },
    {
      provide: ROUTER_AGENT_REGISTRY,
      inject: [ROUTER_SOLANA_CLIENTS],
      useFactory: (clients: SolanaProgramClients) =>
        new SolanaAgentRegistryAdapter(clients.agentRegistry),
    },
    {
      provide: ROUTER_TASK_ESCROW,
      inject: [ROUTER_SOLANA_CLIENTS],
      useFactory: (clients: SolanaProgramClients) =>
        new SolanaTaskEscrowAdapter(clients.taskEscrow),
    },
    {
      provide: ROUTER_SOLANA_CLIENTS,
      useFactory: () => createMockSolanaProgramClients(),
    },
    {
      provide: ROUTER_USE_CASE,
      inject: [ROUTER_LLM, ROUTER_AGENT_REGISTRY, ROUTER_TASK_ESCROW],
      useFactory: (llm: IRouterLlm, registry: IAgentRegistry, escrow: ITaskEscrow) =>
        new RouterService(llm, registry, escrow),
    },
  ],
  exports: [ROUTER_USE_CASE],
})
export class RouterModule {}
