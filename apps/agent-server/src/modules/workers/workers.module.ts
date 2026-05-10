import { join } from "node:path";
import { Module } from "@nestjs/common";
import { X402_CLIENT_USE_CASE, X402Module, type IX402ClientUseCase } from "../x402";
import { LLM_CLIENT_FACTORY } from "../../shared/llm/llm.module";
import type { LLMClientFactory } from "../../shared/llm/LLMClientFactory";
import {
  createMockSolanaProgramClients,
  type SolanaProgramClients,
} from "../../shared/solana/programs";
import { WorkerController } from "./adapters/inbound/WorkerController";
import { DeterministicWebSearchAdapter } from "./adapters/outbound/DeterministicWebSearchAdapter";
import { JupiterSwapAdapter } from "./adapters/outbound/JupiterSwapAdapter";
import { PythOracleAdapter } from "./adapters/outbound/PythOracleAdapter";
import { PythonSubprocessAdapter } from "./adapters/outbound/PythonSubprocessAdapter";
import { SolanaConsensusAdapter } from "./adapters/outbound/SolanaConsensusAdapter";
import { SolanaTaskEscrowAdapter } from "./adapters/outbound/SolanaTaskEscrowAdapter";
import { WorkerLlmAdapter } from "./adapters/outbound/WorkerLlmAdapter";
import { X402ClientAdapter } from "./adapters/outbound/X402ClientAdapter";
import { AnalyzerService } from "./domain/analyzer/AnalyzerService";
import { ExecutorService } from "./domain/executor/ExecutorService";
import type { WorkerAgent } from "./domain/base/types";
import { ResearcherService } from "./domain/researcher/ResearcherService";
import { ValidatorService } from "./domain/validator/ValidatorService";
import { WorkerRegistryService } from "./domain/WorkerRegistryService";
import type { IConsensus } from "./ports/outbound/IConsensus";
import type { IJupiterClient } from "./ports/outbound/IJupiterClient";
import type { IPythonSubprocess } from "./ports/outbound/IPythonSubprocess";
import type { IPythOracleClient } from "./ports/outbound/IPythOracleClient";
import type { ITaskEscrow } from "./ports/outbound/ITaskEscrow";
import type { IWebSearchClient } from "./ports/outbound/IWebSearchClient";
import type { IWorkerLlm } from "./ports/outbound/IWorkerLlm";
import type { IX402Client } from "./ports/outbound/IX402Client";

export const WORKER_USE_CASE = Symbol("WORKER_USE_CASE");
export const WORKER_LLM = Symbol("WORKER_LLM");
export const WORKER_TASK_ESCROW = Symbol("WORKER_TASK_ESCROW");
export const WORKER_CONSENSUS = Symbol("WORKER_CONSENSUS");
export const WORKER_X402 = Symbol("WORKER_X402");
export const WORKER_WEB_SEARCH = Symbol("WORKER_WEB_SEARCH");
export const WORKER_PYTHON = Symbol("WORKER_PYTHON");
export const WORKER_PYTH_ORACLE = Symbol("WORKER_PYTH_ORACLE");
export const WORKER_JUPITER = Symbol("WORKER_JUPITER");
export const WORKER_SOLANA_CLIENTS = Symbol("WORKER_SOLANA_CLIENTS");

@Module({
  imports: [X402Module],
  controllers: [WorkerController],
  providers: [
    {
      provide: WORKER_SOLANA_CLIENTS,
      useFactory: () => createMockSolanaProgramClients(),
    },
    {
      provide: WORKER_LLM,
      inject: [LLM_CLIENT_FACTORY],
      useFactory: (llmFactory: LLMClientFactory) => new WorkerLlmAdapter(llmFactory),
    },
    {
      provide: WORKER_TASK_ESCROW,
      inject: [WORKER_SOLANA_CLIENTS],
      useFactory: (clients: SolanaProgramClients) =>
        new SolanaTaskEscrowAdapter(clients.taskEscrow),
    },
    {
      provide: WORKER_CONSENSUS,
      inject: [WORKER_SOLANA_CLIENTS],
      useFactory: (clients: SolanaProgramClients) => new SolanaConsensusAdapter(clients.consensus),
    },
    {
      provide: WORKER_X402,
      inject: [X402_CLIENT_USE_CASE],
      useFactory: (x402: IX402ClientUseCase) => new X402ClientAdapter(x402),
    },
    {
      provide: WORKER_WEB_SEARCH,
      useFactory: () => new DeterministicWebSearchAdapter(),
    },
    {
      provide: WORKER_PYTHON,
      useFactory: () => new PythonSubprocessAdapter(),
    },
    {
      provide: WORKER_PYTH_ORACLE,
      useFactory: () => new PythOracleAdapter(),
    },
    {
      provide: WORKER_JUPITER,
      useFactory: () => new JupiterSwapAdapter(),
    },
    {
      provide: ResearcherService,
      inject: [WORKER_TASK_ESCROW, WORKER_LLM, WORKER_WEB_SEARCH, WORKER_X402, WORKER_PYTHON],
      useFactory: (
        taskEscrow: ITaskEscrow,
        llm: IWorkerLlm,
        webSearch: IWebSearchClient,
        x402: IX402Client,
        python: IPythonSubprocess,
      ) =>
        new ResearcherService(
          taskEscrow,
          llm,
          webSearch,
          x402,
          python,
          join(process.cwd(), "workers-py", "researcher", "researcher.py"),
        ),
    },
    {
      provide: AnalyzerService,
      inject: [WORKER_TASK_ESCROW, WORKER_LLM, WORKER_PYTHON],
      useFactory: (taskEscrow: ITaskEscrow, llm: IWorkerLlm, python: IPythonSubprocess) =>
        new AnalyzerService(
          taskEscrow,
          llm,
          python,
          join(process.cwd(), "workers-py", "analyzer", "analyzer.py"),
        ),
    },
    {
      provide: ExecutorService,
      inject: [WORKER_TASK_ESCROW, WORKER_PYTH_ORACLE, WORKER_JUPITER],
      useFactory: (taskEscrow: ITaskEscrow, pyth: IPythOracleClient, jupiter: IJupiterClient) =>
        new ExecutorService(taskEscrow, pyth, jupiter),
    },
    {
      provide: ValidatorService,
      inject: [WORKER_TASK_ESCROW, WORKER_LLM, WORKER_CONSENSUS],
      useFactory: (taskEscrow: ITaskEscrow, llm: IWorkerLlm, consensus: IConsensus) =>
        new ValidatorService(taskEscrow, llm, consensus),
    },
    {
      provide: WORKER_USE_CASE,
      inject: [ResearcherService, AnalyzerService, ExecutorService, ValidatorService],
      useFactory: (
        researcher: ResearcherService,
        analyzer: AnalyzerService,
        executor: ExecutorService,
        validator: ValidatorService,
      ) =>
        new WorkerRegistryService([
          researcher,
          analyzer,
          executor,
          validator,
        ] satisfies WorkerAgent[]),
    },
  ],
  exports: [WORKER_USE_CASE],
})
export class WorkersModule {}
