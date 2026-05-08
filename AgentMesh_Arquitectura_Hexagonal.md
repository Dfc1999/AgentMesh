# AgentMesh — Arquitectura Hexagonal del Backend

> Guía de arquitectura para todos los módulos off-chain de `apps/agent-server/`.
> Aplica a: Optimizer, Router, Judge, Orchestrator, Workers, x402.
> Actualización de implementación: `apps/agent-server/` usa NestJS como shell de aplicación. NestJS se limita al arranque, controllers, dependency injection y composición de módulos; la regla hexagonal sigue vigente y `domain/` no debe importar NestJS, SDKs externos ni adapters.

---

## Tabla de Contenidos

1. [Principio central](#1-principio-central)
2. [Estructura por módulo](#2-estructura-por-módulo)
3. [Reglas de dependencia](#3-reglas-de-dependencia)
4. [Módulo: Optimizer](#4-módulo-optimizer)
5. [Módulo: Router](#5-módulo-router)
6. [Módulo: Judge](#6-módulo-judge)
7. [Módulo: Orchestrator](#7-módulo-orchestrator)
8. [Módulo: Workers](#8-módulo-workers)
9. [Módulo: x402](#9-módulo-x402)
10. [Infraestructura compartida (shared/)](#10-infraestructura-compartida-shared)
11. [Cómo escribir un test unitario](#11-cómo-escribir-un-test-unitario)
12. [Cómo agregar un nuevo adaptador](#12-cómo-agregar-un-nuevo-adaptador)
13. [Estructura completa del repositorio](#13-estructura-completa-del-repositorio)

---

## 1. Principio central

La arquitectura hexagonal divide cada módulo en tres zonas con una regla de dependencia estricta:

```
┌─────────────────────────────────────────────┐
│                 ADAPTERS                    │  ← conoce el mundo exterior
│   (Anthropic, Solana, Redis, HTTP, Mocks)   │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │              PORTS                  │   │  ← interfaces / contratos
│   │   (ILLMClient, IAgentRegistry...)   │   │
│   │                                     │   │
│   │   ┌───────────────────────────┐     │   │
│   │   │         DOMAIN            │     │   │  ← lógica pura, sin imports externos
│   │   │   (Service, Entities,     │     │   │
│   │   │    Value Objects, Types)  │     │   │
│   │   └───────────────────────────┘     │   │
│   └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**La regla más importante:** el `domain/` nunca importa nada de `adapters/`.
Solo importa de `ports/` (interfaces) y de `packages/shared-types/`.

En la implementación NestJS, los decorators como `@Module()`, `@Controller()` e `@Injectable()` pertenecen al shell, controllers o adapters. Los servicios de dominio deben mantenerse como clases TypeScript puras siempre que sea posible.

Esto significa que puedes testear toda la lógica de negocio sin levantar Redis,
sin llamar a Anthropic y sin conectarte a Solana.

---

## 2. Estructura por módulo

Todos los módulos siguen exactamente esta estructura de carpetas:

```
modules/<nombre>/
├── domain/
│   ├── <Nombre>Service.ts      ← lógica de negocio pura
│   ├── entities.ts             ← entidades del dominio (si aplica)
│   └── types.ts                ← tipos internos del módulo
├── ports/
│   ├── inbound/
│   │   └── I<Nombre>UseCase.ts ← interfaz que el módulo expone hacia afuera
│   └── outbound/
│       ├── ILLMClient.ts       ← lo que el módulo necesita del LLM
│       ├── ISolanaClient.ts    ← lo que necesita de Solana (si aplica)
│       └── I<Otro>Port.ts      ← cualquier dependencia externa
├── adapters/
│   ├── inbound/
│   │   └── <Nombre>Controller.ts  ← punto de entrada NestJS o llamada desde otro módulo
│   └── outbound/
│       ├── AnthropicAdapter.ts    ← implementación real del ILLMClient
│       ├── SolanaAdapter.ts       ← implementación real del ISolanaClient
│       └── __mocks__/
│           ├── MockLLMAdapter.ts  ← para tests
│           └── MockSolanaAdapter.ts
├── index.ts                    ← exporta solo lo que otros módulos necesitan ver
└── <nombre>.module.ts          ← wiring NestJS: conecta ports con adapters (composición)
```

---

## 3. Reglas de dependencia

```
✅ PERMITIDO                          ❌ PROHIBIDO
─────────────────────────────────    ──────────────────────────────────────────
domain/ → ports/outbound/            domain/ → adapters/
domain/ → packages/shared-types/     domain/ → redis, anthropic, @solana/web3.js
ports/  → packages/shared-types/     ports/  → adapters/
adapters/ → ports/                   adapters/ → domain/ de OTRO módulo
adapters/ → paquetes npm externos    módulo A → módulo B directamente (sin index.ts)
index.ts → domain/types.ts           index.ts → domain/ internals
index.ts → ports/inbound/            cualquier import circular
```

**Comunicación entre módulos:** siempre a través del `index.ts` del módulo.
Nunca importar desde `modules/router/domain/RouterService.ts` directamente
desde otro módulo — solo desde `modules/router/index.ts`.

---

## 4. Módulo: Optimizer

**Responsabilidad:** recibir el query crudo del usuario, aplicar el pipeline de 6 etapas
y devolver un `OptimizedQuery` al Router.

```
modules/optimizer/
├── domain/
│   ├── OptimizerService.ts
│   │   └── run(rawQuery: string): Promise<OptimizedQuery>
│   ├── pipeline/
│   │   ├── SemanticCacheStep.ts
│   │   ├── IntentClassifierStep.ts
│   │   ├── SkillMatcherStep.ts
│   │   ├── RagSearchStep.ts
│   │   ├── ContextPruningStep.ts
│   │   └── PromptCacheStep.ts
│   └── types.ts
│       └── PipelineStep, StepResult, OptimizedQuery (re-exporta de shared-types)
│
├── ports/
│   ├── inbound/
│   │   └── IOptimizerUseCase.ts
│   │       └── run(rawQuery: string): Promise<OptimizedQuery>
│   └── outbound/
│       ├── ISemanticCacheStore.ts
│       │   ├── search(embedding: number[], threshold: number): Promise<CacheHit | null>
│       │   └── store(embedding: number[], response: string, ttl: number): Promise<void>
│       ├── IEmbeddingClient.ts
│       │   └── embed(text: string): Promise<number[]>
│       ├── IVectorStore.ts
│       │   └── search(embedding: number[], topK: number, minScore: number): Promise<Chunk[]>
│       └── ILLMClient.ts
│           └── complete(req: CompletionRequest): Promise<CompletionResponse>
│
├── adapters/
│   ├── inbound/
│   │   └── OptimizerController.ts    ← llamado por main.ts con el query del usuario
│   └── outbound/
│       ├── RedisSemanticCacheAdapter.ts   ← implementa ISemanticCacheStore
│       ├── OpenAIEmbeddingAdapter.ts      ← implementa IEmbeddingClient
│       ├── PgVectorStoreAdapter.ts        ← implementa IVectorStore
│       ├── AnthropicPromptCacheAdapter.ts ← implementa ILLMClient con prefix caching
│       └── __mocks__/
│           ├── MockCacheStore.ts
│           ├── MockEmbeddingClient.ts
│           └── MockVectorStore.ts
│
├── index.ts
│   └── export { IOptimizerUseCase, OptimizedQuery }
└── optimizer.module.ts               ← wiring de dependencias
```

### Ejemplo de código: OptimizerService.ts

```typescript
// domain/OptimizerService.ts
// ✅ Solo importa de ports/ y shared-types/ — nunca de redis, anthropic, etc.

import type { ISemanticCacheStore } from "../ports/outbound/ISemanticCacheStore";
import type { IEmbeddingClient } from "../ports/outbound/IEmbeddingClient";
import type { IVectorStore } from "../ports/outbound/IVectorStore";
import type { ILLMClient } from "../ports/outbound/ILLMClient";
import type { OptimizedQuery } from "@agentmesh/shared-types";

export class OptimizerService {
  constructor(
    private readonly cache: ISemanticCacheStore,
    private readonly embedder: IEmbeddingClient,
    private readonly vectorStore: IVectorStore,
    private readonly llm: ILLMClient,
  ) {}

  async run(rawQuery: string): Promise<OptimizedQuery> {
    const embedding = await this.embedder.embed(rawQuery);

    // Etapa 1: Semantic Cache
    const cacheHit = await this.cache.search(embedding, 0.97);
    if (cacheHit) {
      return {
        content: rawQuery,
        intentClassification: { needsDocs: false, complexityHint: 0 },
        metrics: { cacheHit: true, originalTokens: 0, processedTokens: 0,
                   reductionPercent: 100, techniquesApplied: ["semantic_cache"],
                   estimatedQualityRisk: "none", latencyMs: 0 },
        cachedResponse: cacheHit.response,
      };
    }

    // Etapas 2-6: pipeline completo...
    // (cada etapa es un método privado que llama al port correspondiente)
  }
}
```

### Ejemplo: optimizer.module.ts (wiring)

```typescript
// optimizer.module.ts
// ✅ Este es el único archivo que importa de adapters/ Y de domain/
// Es el punto de composición — conecta todo.

import { OptimizerService } from "./domain/OptimizerService";
import { RedisSemanticCacheAdapter } from "./adapters/outbound/RedisSemanticCacheAdapter";
import { OpenAIEmbeddingAdapter } from "./adapters/outbound/OpenAIEmbeddingAdapter";
import { PgVectorStoreAdapter } from "./adapters/outbound/PgVectorStoreAdapter";
import { AnthropicPromptCacheAdapter } from "./adapters/outbound/AnthropicPromptCacheAdapter";
import type { IOptimizerUseCase } from "./ports/inbound/IOptimizerUseCase";

export function createOptimizerModule(deps: {
  redisClient: Redis;
  pgClient: PrismaClient;
  anthropicClient: Anthropic;
  openAIClient: OpenAI;
}): IOptimizerUseCase {
  return new OptimizerService(
    new RedisSemanticCacheAdapter(deps.redisClient),
    new OpenAIEmbeddingAdapter(deps.openAIClient),
    new PgVectorStoreAdapter(deps.pgClient),
    new AnthropicPromptCacheAdapter(deps.anthropicClient),
  );
}

// Para tests — inyecta mocks en lugar de adapters reales
export function createOptimizerModuleForTest(): IOptimizerUseCase {
  return new OptimizerService(
    new MockCacheStore(),
    new MockEmbeddingClient(),
    new MockVectorStore(),
    new MockLLMAdapter(),
  );
}
```

---

## 5. Módulo: Router

**Responsabilidad:** clasificar la complejidad del `OptimizedQuery` y decidir
tier, modelo y presupuesto. Declarar el tier on-chain en el Task Escrow.

```
modules/router/
├── domain/
│   ├── RouterService.ts
│   │   └── classify(query: OptimizedQuery, escrowCtx: EscrowContext): Promise<RouterDecision>
│   ├── TierClassifier.ts      ← lógica de reglas de tier (sin LLM)
│   └── types.ts
│       └── EscrowContext, RouterDecision, Tier, ModelId
│
├── ports/
│   ├── inbound/
│   │   └── IRouterUseCase.ts
│   └── outbound/
│       ├── ILLMClient.ts
│       │   └── complete(req): Promise<CompletionResponse>
│       ├── IAgentRegistry.ts
│       │   └── getRoutingRules(agentPda: string): Promise<RoutingRules>
│       └── ITaskEscrow.ts
│           └── declareTier(subtaskPda, tier, modelId, budgetSlice): Promise<TxSignature>
│
├── adapters/
│   ├── inbound/
│   │   └── RouterController.ts
│   └── outbound/
│       ├── AnthropicHaikuAdapter.ts      ← implementa ILLMClient con Haiku
│       ├── SolanaRegistryAdapter.ts      ← implementa IAgentRegistry
│       ├── SolanaTaskEscrowAdapter.ts    ← implementa ITaskEscrow
│       └── __mocks__/
│           ├── MockLLMAdapter.ts
│           ├── MockAgentRegistry.ts
│           └── MockTaskEscrow.ts
│
├── index.ts
│   └── export { IRouterUseCase, RouterDecision, Tier, ModelId }
└── router.module.ts
```

### Ejemplo de código: RouterService.ts

```typescript
// domain/RouterService.ts
import type { ILLMClient } from "../ports/outbound/ILLMClient";
import type { IAgentRegistry } from "../ports/outbound/IAgentRegistry";
import type { ITaskEscrow } from "../ports/outbound/ITaskEscrow";
import type { OptimizedQuery, RouterDecision } from "@agentmesh/shared-types";

export class RouterService {
  constructor(
    private readonly llm: ILLMClient,
    private readonly registry: IAgentRegistry,
    private readonly escrow: ITaskEscrow,
  ) {}

  async classify(
    query: OptimizedQuery,
    escrowCtx: EscrowContext,
  ): Promise<RouterDecision> {
    // Si el Optimizer ya resolvió con cache, no hay nada que clasificar
    if (query.metrics.cacheHit) {
      return this.buildDirectReturnDecision(query, escrowCtx);
    }

    // Leer las routing_rules del Agent Registry on-chain
    const rules = await this.registry.getRoutingRules(escrowCtx.routerAgentPda);

    // Llamar Haiku para clasificar la complejidad
    const classification = await this.llm.complete({
      model: "claude-haiku-4-5",
      messages: [{ role: "user", content: this.buildClassificationPrompt(query, rules) }],
      maxTokens: 200,
    });

    const tier = this.resolveTier(classification, rules, escrowCtx.remainingBudget);

    // Declarar el tier on-chain antes de retornar
    const txSignature = await this.escrow.declareTier(
      escrowCtx.subtaskPda,
      tier.tier,
      tier.modelId,
      tier.budgetSlice,
    );

    return { ...tier, subtaskPda: escrowCtx.subtaskPda };
  }
}
```

---

## 6. Módulo: Judge

**Responsabilidad:** evaluar la calidad de la respuesta de un Worker contra el brief original.
Decidir aprobar, solicitar retry, o emitir `low_confidence`.

```
modules/judge/
├── domain/
│   ├── JudgeService.ts
│   │   └── evaluate(response: WorkerResponse, decision: RouterDecision): Promise<JudgeResult>
│   ├── ScoreCalculator.ts     ← calcula el score compuesto de 4 dimensiones
│   ├── RetryPolicy.ts         ← decide si hay que reintentar y a qué tier
│   └── types.ts
│
├── ports/
│   ├── inbound/
│   │   └── IJudgeUseCase.ts
│   └── outbound/
│       ├── ILLMClient.ts
│       ├── ITaskEscrow.ts
│       │   └── retrySubtask(subtaskPda, newTier, newWorker): Promise<TxSignature>
│       ├── IConsensus.ts
│       │   └── submitValidation(subtaskPda, approved, justificationHash): Promise<TxSignature>
│       └── IReputationLedger.ts
│           └── recordTierAccuracy(routerAgent, predictedTier, actualTier, retryHappened): Promise<void>
│
├── adapters/
│   ├── inbound/
│   │   └── JudgeController.ts
│   └── outbound/
│       ├── AnthropicSonnetAdapter.ts     ← Sonnet para evaluación (tier medio)
│       ├── SolanaTaskEscrowAdapter.ts
│       ├── SolanaConsensusAdapter.ts
│       ├── SolanaReputationAdapter.ts
│       └── __mocks__/
│           ├── MockLLMAdapter.ts
│           ├── MockTaskEscrow.ts
│           ├── MockConsensus.ts
│           └── MockReputationLedger.ts
│
├── index.ts
│   └── export { IJudgeUseCase, JudgeResult, JudgeVerdict }
└── judge.module.ts
```

### Puerto clave: IConsensus.ts

```typescript
// ports/outbound/IConsensus.ts
export interface IConsensus {
  submitValidation(
    subtaskPda: string,
    approved: boolean,
    justificationHash: Buffer,   // SHA-256 del razonamiento del Judge
  ): Promise<string>;            // TxSignature

  initializeConsensus(
    subtaskPda: string,
    requiredSigs: number,
    validators: string[],        // PublicKeys de los Validator Agents
  ): Promise<string>;
}
```

---

## 7. Módulo: Orchestrator

**Responsabilidad:** descomponer la tarea en un árbol de subtareas, reclutar workers,
coordinar la ejecución paralela/secuencial y gestionar el ciclo de vida completo.

```
modules/orchestrator/
├── domain/
│   ├── OrchestratorService.ts
│   │   └── execute(taskCtx: TaskContext): Promise<TaskResult>
│   ├── TaskDecomposer.ts      ← genera el árbol de subtareas
│   ├── WorkerRecruiter.ts     ← selecciona workers del registry
│   ├── ExecutionEngine.ts     ← topological sort + ejecución paralela
│   ├── TimeoutManager.ts      ← gestiona deadlines y re-subastas
│   └── types.ts
│       └── TaskContext, SubtaskTree, ExecutionState
│
├── ports/
│   ├── inbound/
│   │   └── IOrchestratorUseCase.ts
│   └── outbound/
│       ├── ILLMClient.ts
│       ├── IAgentRegistry.ts
│       │   └── getAgentsByCapability(mask: bigint, minReputation: number): Promise<AgentInfo[]>
│       ├── ITaskEscrow.ts
│       │   ├── allocateSubtask(taskPda, index, parent, budget, maxRetry): Promise<string>
│       │   └── releaseOrchestratorFee(taskPda): Promise<string>
│       ├── IRouterUseCase.ts          ← puerto hacia el módulo Router
│       ├── IJudgeUseCase.ts           ← puerto hacia el módulo Judge
│       ├── IWorkerUseCase.ts          ← puerto hacia los Workers
│       ├── ISolanaEvents.ts
│       │   └── subscribeToSubtaskEvents(cb: EventHandler): Unsubscribe
│       └── ITaskRepository.ts
│           └── saveSubtaskState / getSubtaskState (Postgres)
│
├── adapters/
│   ├── inbound/
│   │   └── OrchestratorController.ts
│   └── outbound/
│       ├── AnthropicSonnetAdapter.ts
│       ├── SolanaRegistryAdapter.ts
│       ├── SolanaTaskEscrowAdapter.ts
│       ├── SolanaEventsAdapter.ts     ← WebSocket subscriptions
│       ├── PrismaTaskRepository.ts
│       ├── RouterModuleAdapter.ts     ← adapta IRouterUseCase al módulo Router real
│       ├── JudgeModuleAdapter.ts
│       ├── WorkerModuleAdapter.ts
│       └── __mocks__/
│           ├── MockRouter.ts
│           ├── MockJudge.ts
│           ├── MockWorker.ts
│           └── MockSolanaEvents.ts
│
├── index.ts
│   └── export { IOrchestratorUseCase, TaskResult, TaskContext }
└── orchestrator.module.ts
```

### Por qué el Orchestrator tiene puertos hacia Router, Judge y Workers

En hexagonal, incluso las dependencias internas entre módulos van a través de puertos.
Esto permite testear el Orchestrator con mocks de Router y Judge sin levantar esos módulos.

```typescript
// ports/outbound/IRouterUseCase.ts (dentro del módulo Orchestrator)
// Es una copia del contrato que el Router expone — no importa desde router/index.ts
import type { OptimizedQuery, RouterDecision } from "@agentmesh/shared-types";

export interface IRouterUseCase {
  classify(query: OptimizedQuery, escrowCtx: EscrowContext): Promise<RouterDecision>;
}
```

---

## 8. Módulo: Workers

**Responsabilidad:** ejecutar las subtareas concretas. Cada tipo de worker
(Researcher, Analyzer, Executor, Validator) es una implementación del mismo port `IWorkerUseCase`.

```
modules/workers/
├── domain/
│   ├── base/
│   │   ├── BaseWorkerService.ts   ← lógica común a todos los workers
│   │   │   ├── calcularResultHash()
│   │   │   ├── submitResultOnChain()
│   │   │   └── registrarX402Payment()
│   │   └── types.ts
│   ├── researcher/
│   │   └── ResearcherService.ts
│   ├── analyzer/
│   │   └── AnalyzerService.ts
│   ├── executor/
│   │   └── ExecutorService.ts
│   └── validator/
│       └── ValidatorService.ts
│
├── ports/
│   ├── inbound/
│   │   └── IWorkerUseCase.ts
│   │       └── execute(ctx: SubtaskContext): Promise<WorkerResult>
│   └── outbound/
│       ├── ILLMClient.ts
│       ├── ITaskEscrow.ts
│       │   └── submitResult(subtaskPda, resultHash): Promise<TxSignature>
│       ├── IX402Client.ts
│       │   └── fetch(url: string, walletKeypair: Keypair): Promise<Response>
│       ├── IWebSearchClient.ts        ← solo Researcher
│       │   └── search(query: string): Promise<SearchResult[]>
│       ├── IPythOracleClient.ts       ← solo Executor
│       │   └── getPrice(symbol: string): Promise<number>
│       ├── IJupiterClient.ts          ← solo Executor
│       │   └── getSwapQuote(params): Promise<SwapQuote>
│       └── IPythonSubprocess.ts       ← Researcher + Analyzer (bridge a Python)
│           └── run(script, input): Promise<string>
│
├── adapters/
│   ├── inbound/
│   │   └── WorkerController.ts
│   └── outbound/
│       ├── AnthropicAdapter.ts
│       ├── SolanaTaskEscrowAdapter.ts
│       ├── X402ClientAdapter.ts
│       ├── DuckDuckGoSearchAdapter.ts
│       ├── PythOracleAdapter.ts
│       ├── JupiterSwapAdapter.ts
│       ├── PythonSubprocessAdapter.ts
│       └── __mocks__/
│           ├── MockLLMAdapter.ts
│           ├── MockTaskEscrow.ts
│           ├── MockX402Client.ts
│           ├── MockWebSearch.ts
│           └── MockPythonSubprocess.ts
│
├── index.ts
│   └── export { IWorkerUseCase, WorkerResult, SubtaskContext }
└── workers.module.ts
    └── crea instancias de Researcher, Analyzer, Executor, Validator
        y las registra como implementaciones de IWorkerUseCase
```

---

## 9. Módulo: x402

**Responsabilidad:** cliente y servidor de micropagos HTTP.
Es una dependencia de Workers (cliente) y expone endpoints propios (servidor).

```
modules/x402/
├── domain/
│   ├── X402ClientService.ts
│   │   └── fetch(url, keypair): Promise<Response>
│   ├── X402ServerService.ts
│   │   └── verifyAndProcess(req): Promise<VerificationResult>
│   └── types.ts
│       └── PaymentPayload, PaymentProof, VerificationResult
│
├── ports/
│   ├── inbound/
│   │   ├── IX402ClientUseCase.ts
│   │   └── IX402ServerMiddleware.ts
│   └── outbound/
│       ├── ISolanaRPC.ts
│       │   ├── sendTransaction(tx): Promise<TxSignature>
│       │   └── confirmTransaction(sig): Promise<boolean>
│       └── IProofCache.ts
│           └── isAlreadyUsed(txSignature): Promise<boolean>
│
├── adapters/
│   ├── inbound/
│   │   ├── X402ClientAdapter.ts     ← wrapper sobre fetch nativo
│   │   └── X402ExpressMiddleware.ts ← middleware para Fastify/Express
│   └── outbound/
│       ├── SolanaRPCAdapter.ts
│       ├── RedisProofCacheAdapter.ts
│       └── __mocks__/
│           ├── MockSolanaRPC.ts
│           └── MockProofCache.ts
│
├── index.ts
│   └── export { IX402ClientUseCase, IX402ServerMiddleware }
└── x402.module.ts
```

---

## 10. Infraestructura compartida (shared/)

La carpeta `shared/` no sigue hexagonal — es infraestructura pura que
los adaptadores consumen directamente. El dominio NUNCA importa de `shared/`.

```
shared/
├── llm/
│   ├── LLMClientFactory.ts        ← crea AnthropicClient, OpenAIClient, GeminiClient
│   ├── RetryHandler.ts            ← exponential backoff para todos los proveedores
│   ├── RateLimiter.ts
│   └── types.ts
│       └── CompletionRequest, CompletionResponse (base compartida)
│
├── solana/
│   ├── ConnectionPool.ts          ← pool de conexiones RPC
│   ├── KeypairManager.ts          ← carga y gestiona keypairs de agentes
│   ├── EventSubscriber.ts         ← WebSocket subscriptions a programas Anchor
│   └── AnchorClientFactory.ts     ← crea Program<T> desde IDL
│
└── db/
    ├── RedisClientFactory.ts
    ├── PrismaClientFactory.ts
    └── migrations/
```

---

## 11. Cómo escribir un test unitario

Con hexagonal, los tests unitarios del dominio nunca necesitan
infraestructura real. Ejemplo con el Router:

```typescript
// modules/router/domain/__tests__/RouterService.test.ts

import { RouterService } from "../RouterService";
import { MockLLMAdapter } from "../adapters/outbound/__mocks__/MockLLMAdapter";
import { MockAgentRegistry } from "../adapters/outbound/__mocks__/MockAgentRegistry";
import { MockTaskEscrow } from "../adapters/outbound/__mocks__/MockTaskEscrow";

describe("RouterService", () => {
  let service: RouterService;
  let mockLLM: MockLLMAdapter;
  let mockEscrow: MockTaskEscrow;

  beforeEach(() => {
    mockLLM = new MockLLMAdapter();
    mockEscrow = new MockTaskEscrow();
    service = new RouterService(mockLLM, new MockAgentRegistry(), mockEscrow);
  });

  it("devuelve tier simple para query factual corta", async () => {
    mockLLM.setNextResponse({ complexity: 0.2, tokenEstimate: 30 });

    const result = await service.classify(mockOptimizedQuery, mockEscrowCtx);

    expect(result.tier).toBe("simple");
    expect(result.modelId).toBe("claude-haiku-4-5");
    // ✅ Sin llamadas a Solana, sin llamadas reales a Anthropic
  });

  it("degrada el tier si el presupuesto no alcanza para complex", async () => {
    mockLLM.setNextResponse({ complexity: 0.9, tokenEstimate: 500 });
    const ctxConPresupuestoBajo = { ...mockEscrowCtx, remainingBudget: 100 };

    const result = await service.classify(mockOptimizedQuery, ctxConPresupuestoBajo);

    expect(result.tier).toBe("medium");
    expect(result.warnings).toContain("budget_degraded");
  });
});
```

---

## 12. Cómo agregar un nuevo adaptador

Ejemplo: agregar soporte a **Gemini Flash** como opción para el Router.

**Paso 1:** El port ya existe (`ILLMClient.ts`) — no hay que cambiarlo.

**Paso 2:** Crear el adaptador:

```typescript
// modules/router/adapters/outbound/GeminiFlashAdapter.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ILLMClient, CompletionRequest, CompletionResponse } from "../../ports/outbound/ILLMClient";

export class GeminiFlashAdapter implements ILLMClient {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const model = this.client.getGenerativeModel({ model: "gemini-flash-2.0" });
    const result = await model.generateContent(req.messages[0].content);
    return {
      content: result.response.text(),
      inputTokens: 0,   // Gemini no expone esto igual que Anthropic
      outputTokens: 0,
      latencyMs: 0,
    };
  }
}
```

**Paso 3:** Registrar en el módulo:

```typescript
// router.module.ts — agregar la opción
const llmClient = config.routerProvider === "gemini"
  ? new GeminiFlashAdapter(env.GEMINI_API_KEY)
  : new AnthropicHaikuAdapter(env.ANTHROPIC_API_KEY);
```

**El dominio no cambió ni una línea.** ✅

---

## 13. Estructura completa del repositorio

Con la arquitectura hexagonal aplicada, la estructura completa queda así:

```
agentmesh/
├── apps/
│   ├── agent-server/
│   │   ├── modules/
│   │   │   ├── optimizer/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── OptimizerService.ts
│   │   │   │   │   ├── pipeline/
│   │   │   │   │   │   ├── SemanticCacheStep.ts
│   │   │   │   │   │   ├── IntentClassifierStep.ts
│   │   │   │   │   │   ├── SkillMatcherStep.ts
│   │   │   │   │   │   ├── RagSearchStep.ts
│   │   │   │   │   │   ├── ContextPruningStep.ts
│   │   │   │   │   │   └── PromptCacheStep.ts
│   │   │   │   │   └── types.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/IOptimizerUseCase.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── ISemanticCacheStore.ts
│   │   │   │   │       ├── IEmbeddingClient.ts
│   │   │   │   │       ├── IVectorStore.ts
│   │   │   │   │       └── ILLMClient.ts
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── inbound/OptimizerController.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── RedisSemanticCacheAdapter.ts
│   │   │   │   │       ├── OpenAIEmbeddingAdapter.ts
│   │   │   │   │       ├── PgVectorStoreAdapter.ts
│   │   │   │   │       ├── AnthropicPromptCacheAdapter.ts
│   │   │   │   │       └── __mocks__/
│   │   │   │   ├── index.ts
│   │   │   │   └── optimizer.module.ts
│   │   │   │
│   │   │   ├── router/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── RouterService.ts
│   │   │   │   │   ├── TierClassifier.ts
│   │   │   │   │   └── types.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/IRouterUseCase.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── ILLMClient.ts
│   │   │   │   │       ├── IAgentRegistry.ts
│   │   │   │   │       └── ITaskEscrow.ts
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── inbound/RouterController.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── AnthropicHaikuAdapter.ts
│   │   │   │   │       ├── SolanaRegistryAdapter.ts
│   │   │   │   │       ├── SolanaTaskEscrowAdapter.ts
│   │   │   │   │       └── __mocks__/
│   │   │   │   ├── index.ts
│   │   │   │   └── router.module.ts
│   │   │   │
│   │   │   ├── judge/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── JudgeService.ts
│   │   │   │   │   ├── ScoreCalculator.ts
│   │   │   │   │   ├── RetryPolicy.ts
│   │   │   │   │   └── types.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/IJudgeUseCase.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── ILLMClient.ts
│   │   │   │   │       ├── ITaskEscrow.ts
│   │   │   │   │       ├── IConsensus.ts
│   │   │   │   │       └── IReputationLedger.ts
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── inbound/JudgeController.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── AnthropicSonnetAdapter.ts
│   │   │   │   │       ├── SolanaTaskEscrowAdapter.ts
│   │   │   │   │       ├── SolanaConsensusAdapter.ts
│   │   │   │   │       ├── SolanaReputationAdapter.ts
│   │   │   │   │       └── __mocks__/
│   │   │   │   ├── index.ts
│   │   │   │   └── judge.module.ts
│   │   │   │
│   │   │   ├── orchestrator/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── OrchestratorService.ts
│   │   │   │   │   ├── TaskDecomposer.ts
│   │   │   │   │   ├── WorkerRecruiter.ts
│   │   │   │   │   ├── ExecutionEngine.ts
│   │   │   │   │   ├── TimeoutManager.ts
│   │   │   │   │   └── types.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/IOrchestratorUseCase.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── ILLMClient.ts
│   │   │   │   │       ├── IAgentRegistry.ts
│   │   │   │   │       ├── ITaskEscrow.ts
│   │   │   │   │       ├── IRouterUseCase.ts
│   │   │   │   │       ├── IJudgeUseCase.ts
│   │   │   │   │       ├── IWorkerUseCase.ts
│   │   │   │   │       ├── ISolanaEvents.ts
│   │   │   │   │       └── ITaskRepository.ts
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── inbound/OrchestratorController.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── AnthropicSonnetAdapter.ts
│   │   │   │   │       ├── SolanaRegistryAdapter.ts
│   │   │   │   │       ├── SolanaTaskEscrowAdapter.ts
│   │   │   │   │       ├── SolanaEventsAdapter.ts
│   │   │   │   │       ├── PrismaTaskRepository.ts
│   │   │   │   │       ├── RouterModuleAdapter.ts
│   │   │   │   │       ├── JudgeModuleAdapter.ts
│   │   │   │   │       ├── WorkerModuleAdapter.ts
│   │   │   │   │       └── __mocks__/
│   │   │   │   ├── index.ts
│   │   │   │   └── orchestrator.module.ts
│   │   │   │
│   │   │   ├── workers/
│   │   │   │   ├── domain/
│   │   │   │   │   ├── base/
│   │   │   │   │   │   ├── BaseWorkerService.ts
│   │   │   │   │   │   └── types.ts
│   │   │   │   │   ├── researcher/ResearcherService.ts
│   │   │   │   │   ├── analyzer/AnalyzerService.ts
│   │   │   │   │   ├── executor/ExecutorService.ts
│   │   │   │   │   └── validator/ValidatorService.ts
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/IWorkerUseCase.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── ILLMClient.ts
│   │   │   │   │       ├── ITaskEscrow.ts
│   │   │   │   │       ├── IX402Client.ts
│   │   │   │   │       ├── IWebSearchClient.ts
│   │   │   │   │       ├── IPythOracleClient.ts
│   │   │   │   │       ├── IJupiterClient.ts
│   │   │   │   │       └── IPythonSubprocess.ts
│   │   │   │   ├── adapters/
│   │   │   │   │   ├── inbound/WorkerController.ts
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── AnthropicAdapter.ts
│   │   │   │   │       ├── SolanaTaskEscrowAdapter.ts
│   │   │   │   │       ├── X402ClientAdapter.ts
│   │   │   │   │       ├── DuckDuckGoSearchAdapter.ts
│   │   │   │   │       ├── PythOracleAdapter.ts
│   │   │   │   │       ├── JupiterSwapAdapter.ts
│   │   │   │   │       ├── PythonSubprocessAdapter.ts
│   │   │   │   │       └── __mocks__/
│   │   │   │   ├── index.ts
│   │   │   │   └── workers.module.ts
│   │   │   │
│   │   │   └── x402/
│   │   │       ├── domain/
│   │   │       │   ├── X402ClientService.ts
│   │   │       │   ├── X402ServerService.ts
│   │   │       │   └── types.ts
│   │   │       ├── ports/
│   │   │       │   ├── inbound/
│   │   │       │   │   ├── IX402ClientUseCase.ts
│   │   │       │   │   └── IX402ServerMiddleware.ts
│   │   │       │   └── outbound/
│   │   │       │       ├── ISolanaRPC.ts
│   │   │       │       └── IProofCache.ts
│   │   │       ├── adapters/
│   │   │       │   ├── inbound/
│   │   │       │   │   ├── X402ClientAdapter.ts
│   │   │       │   │   └── X402ExpressMiddleware.ts
│   │   │       │   └── outbound/
│   │   │       │       ├── SolanaRPCAdapter.ts
│   │   │       │       ├── RedisProofCacheAdapter.ts
│   │   │       │       └── __mocks__/
│   │   │       ├── index.ts
│   │   │       └── x402.module.ts
│   │   │
│   │   ├── shared/
│   │   │   ├── llm/
│   │   │   │   ├── LLMClientFactory.ts
│   │   │   │   ├── RetryHandler.ts
│   │   │   │   ├── RateLimiter.ts
│   │   │   │   └── types.ts
│   │   │   ├── solana/
│   │   │   │   ├── ConnectionPool.ts
│   │   │   │   ├── KeypairManager.ts
│   │   │   │   ├── EventSubscriber.ts
│   │   │   │   └── AnchorClientFactory.ts
│   │   │   └── db/
│   │   │       ├── RedisClientFactory.ts
│   │   │       └── PrismaClientFactory.ts
│   │   │
│   │   └── main.ts                ← wiring global: crea todos los módulos e inyecta dependencias
│   │
│   └── web/                       # Frontend Next.js 14 (sin cambios)
│
├── packages/
│   ├── shared-types/              # Contratos entre módulos (OptimizedQuery, RouterDecision, etc.)
│   ├── sdk/                       # SDK cliente
│   └── idl/                       # IDL generados por Anchor
│
├── programs/                      # Rust / Anchor (sin cambios)
├── workers-py/                    # Python subprocesses (sin cambios)
└── ...
```

---

## Checklist por módulo antes de hacer merge

Antes de hacer merge de cualquier módulo, verificar:

- [ ] `domain/` no tiene ningún import de `adapters/`, `redis`, `@solana/web3.js`, `anthropic`, etc.
- [ ] `domain/` no importa desde el `index.ts` de otro módulo directamente (solo de `shared-types`)
- [ ] Todos los ports de `outbound/` son interfaces (solo `interface`, nunca `class`)
- [ ] Existe al menos un mock por cada port de `outbound/`
- [ ] Los tests unitarios del `domain/` usan únicamente mocks — sin infraestructura real
- [ ] El `index.ts` solo exporta lo que otros módulos necesitan ver
- [ ] El `<nombre>.module.ts` es el único archivo que importa de `adapters/` y de `domain/` juntos

---

*AgentMesh — Arquitectura Hexagonal v1.0*
*Aplicar a todos los módulos de `apps/agent-server/modules/`*
