import { Module } from "@nestjs/common";
import { ENV } from "../../config/config.module";
import type { Env } from "../../config/env";
import { LLM_CLIENT_FACTORY } from "../../shared/llm/llm.module";
import type { LLMClientFactory } from "../../shared/llm/LLMClientFactory";
import type { LLMClient } from "../../shared/llm/types";
import { HeuristicLLMAdapter } from "./adapters/outbound/HeuristicLLMAdapter";
import { LLMFactoryAdapter } from "./adapters/outbound/LLMFactoryAdapter";
import { DeterministicEmbeddingAdapter } from "./adapters/outbound/DeterministicEmbeddingAdapter";
import { InMemorySemanticCacheAdapter } from "./adapters/outbound/InMemorySemanticCacheAdapter";
import { InMemorySkillStore } from "./adapters/outbound/InMemorySkillStore";
import { InMemoryVectorStore } from "./adapters/outbound/InMemoryVectorStore";
import { NoopOptimizerTelemetry } from "./adapters/outbound/NoopOptimizerTelemetry";
import { OptimizerController } from "./adapters/inbound/OptimizerController";
import { OptimizerService } from "./domain/OptimizerService";
import { createOptimizerPipeline } from "./domain/pipeline/PipelineComposer";
import type { OptimizerConfig } from "./domain/types";
import type { IEmbeddingClient } from "./ports/outbound/IEmbeddingClient";
import type { ISemanticCacheStore } from "./ports/outbound/ISemanticCacheStore";
import type { ISkillStore } from "./ports/outbound/ISkillStore";
import type { IVectorStore } from "./ports/outbound/IVectorStore";
import {
  OPTIMIZER_CACHE_STORE,
  OPTIMIZER_CONFIG,
  OPTIMIZER_EMBEDDING_CLIENT,
  OPTIMIZER_LLM_CLIENT,
  OPTIMIZER_SKILL_STORE,
  OPTIMIZER_TELEMETRY,
  OPTIMIZER_USE_CASE,
  OPTIMIZER_VECTOR_STORE,
} from "./tokens";

@Module({
  controllers: [OptimizerController],
  providers: [
    {
      provide: OPTIMIZER_CONFIG,
      inject: [ENV],
      useFactory: (env: Env): OptimizerConfig => ({
        semanticCacheThreshold: env.OPTIMIZER_SEMANTIC_CACHE_THRESHOLD,
        skillExactThreshold: env.OPTIMIZER_SKILL_EXACT_THRESHOLD,
        skillPartialThreshold: env.OPTIMIZER_SKILL_PARTIAL_THRESHOLD,
        ragTopK: env.OPTIMIZER_RAG_TOP_K,
        ragMinScore: env.OPTIMIZER_RAG_MIN_SCORE,
        pruningDuplicateThreshold: env.OPTIMIZER_PRUNING_DUPLICATE_THRESHOLD,
        pruningMinRelevance: env.OPTIMIZER_PRUNING_MIN_RELEVANCE,
        defaultCacheTtlSeconds: env.OPTIMIZER_DEFAULT_CACHE_TTL_SECONDS,
        defiCacheTtlSeconds: env.OPTIMIZER_DEFI_CACHE_TTL_SECONDS,
        featureFlags: {
          semanticCache: env.ENABLE_SEMANTIC_CACHE,
          intentClassifier: env.ENABLE_INTENT_CLASSIFIER,
          skillMatching: env.ENABLE_SKILL_MATCHING,
          ragSearch: env.ENABLE_RAG,
          contextPruning: env.ENABLE_CONTEXT_PRUNING,
          promptCache: env.ENABLE_PROMPT_CACHE,
        },
      }),
    },
    {
      provide: OPTIMIZER_EMBEDDING_CLIENT,
      useFactory: () => new DeterministicEmbeddingAdapter(),
    },
    {
      provide: OPTIMIZER_CACHE_STORE,
      useFactory: () => new InMemorySemanticCacheAdapter(),
    },
    {
      provide: OPTIMIZER_SKILL_STORE,
      inject: [OPTIMIZER_EMBEDDING_CLIENT],
      useFactory: (embedder: IEmbeddingClient) => new InMemorySkillStore(embedder),
    },
    {
      provide: OPTIMIZER_VECTOR_STORE,
      inject: [OPTIMIZER_EMBEDDING_CLIENT],
      useFactory: (embedder: IEmbeddingClient) => new InMemoryVectorStore(embedder),
    },
    {
      provide: OPTIMIZER_LLM_CLIENT,
      inject: [ENV, LLM_CLIENT_FACTORY],
      useFactory: (env: Env, factory: LLMClientFactory) =>
        env.ENABLE_REAL_OPTIMIZER_LLM ? new LLMFactoryAdapter(factory) : new HeuristicLLMAdapter(),
    },
    {
      provide: OPTIMIZER_TELEMETRY,
      useFactory: () => new NoopOptimizerTelemetry(),
    },
    {
      provide: OPTIMIZER_USE_CASE,
      inject: [
        OPTIMIZER_CONFIG,
        OPTIMIZER_EMBEDDING_CLIENT,
        OPTIMIZER_CACHE_STORE,
        OPTIMIZER_SKILL_STORE,
        OPTIMIZER_VECTOR_STORE,
        OPTIMIZER_LLM_CLIENT,
      ],
      useFactory: (
        config: OptimizerConfig,
        embedder: IEmbeddingClient,
        cache: ISemanticCacheStore,
        skillStore: ISkillStore,
        vectorStore: IVectorStore,
        llm: LLMClient,
      ) => {
        const pipeline = createOptimizerPipeline({
          embedder,
          cache,
          skillStore,
          vectorStore,
          llm,
          config,
        });

        return new OptimizerService(pipeline, cache, config);
      },
    },
  ],
  exports: [OPTIMIZER_USE_CASE],
})
export class OptimizerModule {}
