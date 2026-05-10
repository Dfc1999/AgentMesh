# EPIC-03 - Pipeline de Optimizacion de Tokens

## Resumen

Esta EPIC implementa el modulo `optimizer` del backend NestJS siguiendo la arquitectura hexagonal definida para AgentMesh. El modulo expone el caso de uso `IOptimizerUseCase.run(rawQuery)` y el endpoint HTTP `POST /optimizer/run`.

La implementacion actual deja el pipeline funcional end-to-end con adapters deterministas/in-memory para desarrollo, tests e integracion temprana. Los ports ya estan separados para reemplazar esos adapters por Redis Stack, pgvector y embeddings reales sin tocar el dominio.

## Archivos principales

- `apps/agent-server/src/modules/optimizer/domain/OptimizerService.ts`: orquestador del caso de uso.
- `apps/agent-server/src/modules/optimizer/domain/pipeline/*`: pasos del pipeline.
- `apps/agent-server/src/modules/optimizer/ports/outbound/*`: contratos para cache, embeddings, skills, vector store y telemetry.
- `apps/agent-server/src/modules/optimizer/adapters/outbound/*`: adapters actuales en memoria/deterministicos.
- `apps/agent-server/src/modules/optimizer/adapters/inbound/OptimizerController.ts`: endpoint NestJS.
- `scripts/eval-optimizer.ts`: evaluador de degradacion por tecnica.
- `tests/fixtures/representative-queries.json`: fixture inicial para evaluacion.

## Pipeline implementado

1. `SemanticCacheStep`
   - Genera embedding de la query.
   - Busca hits por similitud coseno contra `ISemanticCacheStore`.
   - Si hay hit sobre `OPTIMIZER_SEMANTIC_CACHE_THRESHOLD`, retorna `cachedResponse` y corta el pipeline.
   - Guarda resultados no cacheados al final del pipeline con TTL diferenciado para DeFi.

2. `IntentClassifierStep`
   - Clasifica intent, `needsDocs`, `complexityHint` y posible `skillId`.
   - Usa `LLMClient`; por defecto el modulo inyecta `HeuristicLLMAdapter` para no gastar tokens.
   - Si `ENABLE_REAL_OPTIMIZER_LLM=true`, el wiring usa `LLMFactoryAdapter` y el provider real de EPIC-01.

3. `SkillMatcherStep`
   - Busca skills iniciales: `market-research`, `code-review`, `defi-arbitrage`, `data-analysis`, `text-summary`.
   - Match exacto sobre `OPTIMIZER_SKILL_EXACT_THRESHOLD` renderiza template y corta el pipeline.
   - Match parcial sobre `OPTIMIZER_SKILL_PARTIAL_THRESHOLD` deja metadata para Router, pero continua.

4. `RagSearchStep`
   - Ejecuta busqueda solo si `intent.needsDocs === true`.
   - Usa `IVectorStore.search(embedding, topK, minScore)`.
   - El adapter actual trae chunks seed in-memory; el contrato ya soporta pgvector.

5. `ContextPruningStep`
   - Elimina chunks duplicados o de baja relevancia con umbrales conservadores.
   - Nunca deja el resultado sin contexto si habia al menos un chunk disponible.
   - Registra chunks antes/despues y tokens eliminados.

6. `PromptCacheStep`
   - Marca la tecnica de prompt cache y calcula tokens cacheables estimados.
   - El uso real de Anthropic prefix caching ya existe en `AnthropicProvider` mediante `cacheSystemPrompt`.

## Contrato publico

`IOptimizerUseCase.run(rawQuery: string): Promise<OptimizedQuery>`

El resultado usa el tipo compartido `OptimizedQuery`:

- `content`: query procesada o template renderizado.
- `intentClassification`: senales para Router y Orchestrator.
- `metrics`: tokens originales/procesados, reduccion, tecnicas aplicadas, riesgo y latencia.
- `cachedResponse`: presente si semantic cache o skill exacto resolvieron sin worker.
- `contextChunks`: chunks RAG que deben pasar al Router/Worker si existen.

## Variables de entorno

Todas estan documentadas en `.env.example`.

- `ENABLE_SEMANTIC_CACHE`
- `ENABLE_INTENT_CLASSIFIER`
- `ENABLE_SKILL_MATCHING`
- `ENABLE_RAG`
- `ENABLE_CONTEXT_PRUNING`
- `ENABLE_PROMPT_CACHE`
- `ENABLE_REAL_OPTIMIZER_LLM`
- `OPTIMIZER_SEMANTIC_CACHE_THRESHOLD`
- `OPTIMIZER_SKILL_EXACT_THRESHOLD`
- `OPTIMIZER_SKILL_PARTIAL_THRESHOLD`
- `OPTIMIZER_RAG_TOP_K`
- `OPTIMIZER_RAG_MIN_SCORE`
- `OPTIMIZER_PRUNING_DUPLICATE_THRESHOLD`
- `OPTIMIZER_PRUNING_MIN_RELEVANCE`
- `OPTIMIZER_DEFAULT_CACHE_TTL_SECONDS`
- `OPTIMIZER_DEFI_CACHE_TTL_SECONDS`

## Evaluacion

Comando:

```bash
npm run eval:optimizer
```

El script carga `tests/fixtures/representative-queries.json`, corre el pipeline completo y luego desactiva cada tecnica de forma individual. Reporta:

- `avgSimilarity`
- `minSimilarity`
- `safe`

El threshold actual es `0.95`. El fixture inicial tiene 25 queries; antes de usarlo como gate de CI se debe ampliar a 200+ queries representativas, tal como pide el plan.

## Dependencias con epics posteriores

EPIC-04 Router:
- Debe consumir `OptimizedQuery.content`, `intentClassification`, `contextChunks` y `metrics`.
- Si `cachedResponse` viene definido, Router puede devolver respuesta directa o crear una subtarea minima de auditoria, segun la politica que definan.
- `skillMatch` en `intentClassification` sirve para ajustar tier, modelo y presupuesto.

EPIC-05 Judge:
- Puede usar `metrics.techniquesApplied` y `estimatedQualityRisk` para elevar el rigor de evaluacion cuando hubo pruning o RAG.
- Si una respuesta viene de cache o skill exacto, Judge deberia registrar un camino de validacion distinto al de worker LLM.

EPIC-06 Orchestrator:
- Debe llamar primero al Optimizer antes de descomponer o reclutar workers.
- Debe persistir `OptimizerMetrics` en Postgres cuando se implemente telemetry real.

EPIC-07 Workers:
- Deben recibir `content` y `contextChunks` ya procesados, no la query original sin optimizar.
- Para prompts Anthropic, deben mantener el prefijo estatico primero y usar `cacheSystemPrompt=true`.

EPIC-11 Observabilidad:
- Reemplazar `NoopOptimizerTelemetry` por un adapter Prometheus/OpenTelemetry.
- Metricas planeadas: cache hit rate, tokens saved, avg similarity, chunks pruned y latency.

EPIC-12 Testing:
- Agregar suite unitaria del dominio usando los ports mock.
- Ampliar `representative-queries.json` a 200+ casos y activar el script como gate de CI.

## Pendiente para integracion productiva

- Implementar `RedisSemanticCacheAdapter` con Redis Stack/RediSearch real.
- Implementar `PgVectorStoreAdapter` y schema `knowledge_chunks`.
- Implementar ingestion `scripts/ingest-knowledge.ts`.
- Implementar embeddings reales con OpenAI `text-embedding-3-small` o proveedor equivalente.
- Persistir skills en Postgres en lugar de `InMemorySkillStore`.
- Conectar `NoopOptimizerTelemetry` a la capa de observabilidad.
