import { Module } from "@nestjs/common";
import { LLM_CLIENT_FACTORY } from "../../shared/llm/llm.module";
import type { LLMClientFactory } from "../../shared/llm/LLMClientFactory";
import { JudgeLlmAdapter } from "./adapters/outbound/JudgeLlmAdapter";
import { RouterRetryAdapter } from "./adapters/outbound/RouterRetryAdapter";
import { SolanaConsensusAdapter } from "./adapters/outbound/SolanaConsensusAdapter";
import { SolanaReputationLedgerAdapter } from "./adapters/outbound/SolanaReputationLedgerAdapter";
import { SolanaTaskEscrowAdapter } from "./adapters/outbound/SolanaTaskEscrowAdapter";
import { JudgeService } from "./domain/JudgeService";
import type { IConsensus } from "./ports/outbound/IConsensus";
import type { IJudgeLlm } from "./ports/outbound/IJudgeLlm";
import type { IReputationLedger } from "./ports/outbound/IReputationLedger";
import type { IRouterRetry } from "./ports/outbound/IRouterRetry";
import type { ITaskEscrow } from "./ports/outbound/ITaskEscrow";

export const JUDGE_USE_CASE = Symbol("JUDGE_USE_CASE");
export const JUDGE_LLM = Symbol("JUDGE_LLM");
export const JUDGE_CONSENSUS = Symbol("JUDGE_CONSENSUS");
export const JUDGE_TASK_ESCROW = Symbol("JUDGE_TASK_ESCROW");
export const JUDGE_REPUTATION_LEDGER = Symbol("JUDGE_REPUTATION_LEDGER");
export const JUDGE_ROUTER_RETRY = Symbol("JUDGE_ROUTER_RETRY");

@Module({
  providers: [
    {
      provide: JUDGE_LLM,
      inject: [LLM_CLIENT_FACTORY],
      useFactory: (llmFactory: LLMClientFactory) => new JudgeLlmAdapter(llmFactory),
    },
    {
      provide: JUDGE_CONSENSUS,
      useClass: SolanaConsensusAdapter,
    },
    {
      provide: JUDGE_TASK_ESCROW,
      useClass: SolanaTaskEscrowAdapter,
    },
    {
      provide: JUDGE_REPUTATION_LEDGER,
      useClass: SolanaReputationLedgerAdapter,
    },
    {
      provide: JUDGE_ROUTER_RETRY,
      useClass: RouterRetryAdapter,
    },
    {
      provide: JUDGE_USE_CASE,
      inject: [
        JUDGE_LLM,
        JUDGE_CONSENSUS,
        JUDGE_TASK_ESCROW,
        JUDGE_REPUTATION_LEDGER,
        JUDGE_ROUTER_RETRY,
      ],
      useFactory: (
        llm: IJudgeLlm,
        consensus: IConsensus,
        taskEscrow: ITaskEscrow,
        reputationLedger: IReputationLedger,
        routerRetry: IRouterRetry,
      ) => new JudgeService(llm, consensus, taskEscrow, reputationLedger, routerRetry),
    },
  ],
  exports: [JUDGE_USE_CASE],
})
export class JudgeModule {}
