import { Module } from "@nestjs/common";
import { JUDGE_USE_CASE, JudgeModule } from "../judge";
import { OPTIMIZER_USE_CASE, OptimizerModule } from "../optimizer";
import { ROUTER_USE_CASE, RouterModule } from "../router";
import { WORKER_USE_CASE, WorkersModule } from "../workers";
import { LLM_CLIENT_FACTORY } from "../../shared/llm/llm.module";
import type { LLMClientFactory } from "../../shared/llm/LLMClientFactory";
import {
  createMockSolanaProgramClients,
  type SolanaProgramClients,
} from "../../shared/solana/programs";
import { OrchestratorController } from "./adapters/inbound/OrchestratorController";
import { InMemoryTaskRepository } from "./adapters/outbound/InMemoryTaskRepository";
import { NoopSolanaEventsAdapter } from "./adapters/outbound/NoopSolanaEventsAdapter";
import { OrchestratorLlmAdapter } from "./adapters/outbound/OrchestratorLlmAdapter";
import { SolanaAgentRegistryAdapter } from "./adapters/outbound/SolanaAgentRegistryAdapter";
import { SolanaTaskEscrowAdapter } from "./adapters/outbound/SolanaTaskEscrowAdapter";
import { ExecutionEngine } from "./domain/ExecutionEngine";
import { OrchestratorService } from "./domain/OrchestratorService";
import { TaskDecomposer } from "./domain/TaskDecomposer";
import { TimeoutManager } from "./domain/TimeoutManager";
import { WorkerRecruiter } from "./domain/WorkerRecruiter";
import type { OrchestratorConfig, TimeoutPolicy } from "./domain/types";
import type { IAgentRegistry } from "./ports/outbound/IAgentRegistry";
import type { IJudgeUseCase } from "./ports/outbound/IJudgeUseCase";
import type { IOptimizerUseCase } from "./ports/outbound/IOptimizerUseCase";
import type { IOrchestratorLlm } from "./ports/outbound/IOrchestratorLlm";
import type { IRouterUseCase } from "./ports/outbound/IRouterUseCase";
import type { ISolanaEvents } from "./ports/outbound/ISolanaEvents";
import type { ITaskEscrow } from "./ports/outbound/ITaskEscrow";
import type { ITaskRepository } from "./ports/outbound/ITaskRepository";
import type { IWorkerUseCase } from "./ports/outbound/IWorkerUseCase";

export const ORCHESTRATOR_USE_CASE = Symbol("ORCHESTRATOR_USE_CASE");
export const ORCHESTRATOR_LLM = Symbol("ORCHESTRATOR_LLM");
export const ORCHESTRATOR_AGENT_REGISTRY = Symbol("ORCHESTRATOR_AGENT_REGISTRY");
export const ORCHESTRATOR_TASK_ESCROW = Symbol("ORCHESTRATOR_TASK_ESCROW");
export const ORCHESTRATOR_REPOSITORY = Symbol("ORCHESTRATOR_REPOSITORY");
export const ORCHESTRATOR_SOLANA_EVENTS = Symbol("ORCHESTRATOR_SOLANA_EVENTS");
export const ORCHESTRATOR_WORKER = Symbol("ORCHESTRATOR_WORKER");
export const ORCHESTRATOR_CONFIG = Symbol("ORCHESTRATOR_CONFIG");
export const ORCHESTRATOR_TIMEOUT_POLICY = Symbol("ORCHESTRATOR_TIMEOUT_POLICY");
export const ORCHESTRATOR_SOLANA_CLIENTS = Symbol("ORCHESTRATOR_SOLANA_CLIENTS");

@Module({
  imports: [OptimizerModule, RouterModule, JudgeModule, WorkersModule],
  controllers: [OrchestratorController],
  providers: [
    {
      provide: ORCHESTRATOR_CONFIG,
      useFactory: (): OrchestratorConfig => ({
        minWorkerReputation: -10,
        orchestratorFeeBps: 1200,
        defaultRouterAgentPda: "RouterAgentDefaultPda",
        defaultTaskPdaPrefix: "TaskPda",
        defaultSubtaskBudgetLamports: 1_000_000n,
        defaultMaxRetryBudgetLamports: 300_000n,
      }),
    },
    {
      provide: ORCHESTRATOR_TIMEOUT_POLICY,
      useFactory: (): TimeoutPolicy => ({
        heartbeatMs: 30_000,
        subtaskTimeoutMs: 120_000,
      }),
    },
    {
      provide: ORCHESTRATOR_SOLANA_CLIENTS,
      useFactory: () => createMockSolanaProgramClients(),
    },
    {
      provide: ORCHESTRATOR_LLM,
      inject: [LLM_CLIENT_FACTORY],
      useFactory: (llmFactory: LLMClientFactory) => new OrchestratorLlmAdapter(llmFactory),
    },
    {
      provide: ORCHESTRATOR_AGENT_REGISTRY,
      inject: [ORCHESTRATOR_SOLANA_CLIENTS],
      useFactory: (clients: SolanaProgramClients) =>
        new SolanaAgentRegistryAdapter(clients.agentRegistry, clients.reputationLedger),
    },
    {
      provide: ORCHESTRATOR_TASK_ESCROW,
      inject: [ORCHESTRATOR_SOLANA_CLIENTS],
      useFactory: (clients: SolanaProgramClients) =>
        new SolanaTaskEscrowAdapter(clients.taskEscrow),
    },
    {
      provide: ORCHESTRATOR_REPOSITORY,
      useFactory: () => new InMemoryTaskRepository(),
    },
    {
      provide: ORCHESTRATOR_SOLANA_EVENTS,
      useFactory: () => new NoopSolanaEventsAdapter(),
    },
    {
      provide: ORCHESTRATOR_WORKER,
      inject: [WORKER_USE_CASE],
      useFactory: (worker: IWorkerUseCase) => worker,
    },
    {
      provide: TaskDecomposer,
      inject: [ORCHESTRATOR_LLM],
      useFactory: (llm: IOrchestratorLlm) => new TaskDecomposer(llm),
    },
    {
      provide: WorkerRecruiter,
      inject: [ORCHESTRATOR_AGENT_REGISTRY, ORCHESTRATOR_CONFIG],
      useFactory: (registry: IAgentRegistry, config: OrchestratorConfig) =>
        new WorkerRecruiter(registry, config.minWorkerReputation),
    },
    {
      provide: TimeoutManager,
      inject: [ORCHESTRATOR_TIMEOUT_POLICY],
      useFactory: (policy: TimeoutPolicy) => new TimeoutManager(policy),
    },
    {
      provide: ExecutionEngine,
      inject: [
        OPTIMIZER_USE_CASE,
        ROUTER_USE_CASE,
        JUDGE_USE_CASE,
        ORCHESTRATOR_WORKER,
        WorkerRecruiter,
        ORCHESTRATOR_REPOSITORY,
        ORCHESTRATOR_CONFIG,
      ],
      useFactory: (
        optimizer: IOptimizerUseCase,
        router: IRouterUseCase,
        judge: IJudgeUseCase,
        worker: IWorkerUseCase,
        recruiter: WorkerRecruiter,
        repository: ITaskRepository,
        config: OrchestratorConfig,
      ) => new ExecutionEngine(optimizer, router, judge, worker, recruiter, repository, config),
    },
    {
      provide: ORCHESTRATOR_USE_CASE,
      inject: [
        OPTIMIZER_USE_CASE,
        TaskDecomposer,
        ExecutionEngine,
        ORCHESTRATOR_TASK_ESCROW,
        ORCHESTRATOR_REPOSITORY,
        ORCHESTRATOR_SOLANA_EVENTS,
        TimeoutManager,
        ORCHESTRATOR_CONFIG,
      ],
      useFactory: (
        optimizer: IOptimizerUseCase,
        decomposer: TaskDecomposer,
        executionEngine: ExecutionEngine,
        taskEscrow: ITaskEscrow,
        repository: ITaskRepository,
        solanaEvents: ISolanaEvents,
        timeoutManager: TimeoutManager,
        config: OrchestratorConfig,
      ) =>
        new OrchestratorService(
          optimizer,
          decomposer,
          executionEngine,
          taskEscrow,
          repository,
          solanaEvents,
          timeoutManager,
          config,
        ),
    },
  ],
  exports: [ORCHESTRATOR_USE_CASE],
})
export class OrchestratorModule {}
