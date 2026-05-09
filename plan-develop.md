# AgentMesh — Plan Completo de Desarrollo
> Epics, Issues y Arquitectura para GitLab · Aplicación Completa (Full Product)

---

## Tabla de Contenidos

1. [Decisiones de Arquitectura](#1-decisiones-de-arquitectura)
2. [Estructura del Repositorio](#2-estructura-del-repositorio)
3. [EPIC-01 · Setup e Infraestructura Base](#epic-01--setup-e-infraestructura-base)
4. [EPIC-02 · Programas Solana On-Chain](#epic-02--programas-solana-on-chain)
5. [EPIC-03 · Pipeline de Optimización de Tokens](#epic-03--pipeline-de-optimizaci%C3%B3n-de-tokens)
6. [EPIC-04 · Router Agent](#epic-04--router-agent)
7. [EPIC-05 · Judge Agent](#epic-05--judge-agent)
8. [EPIC-06 · Orchestrator Agent](#epic-06--orchestrator-agent)
9. [EPIC-07 · Worker Agents](#epic-07--worker-agents)
10. [EPIC-08 · Capa de Pagos x402](#epic-08--capa-de-pagos-x402)
11. [EPIC-09 · SDK Cliente](#epic-09--sdk-cliente)
12. [EPIC-10 · Frontend — dApp Next.js](#epic-10--frontend--dapp-nextjs)
13. [EPIC-11 · Observabilidad, Métricas y Logging](#epic-11--observabilidad-m%C3%A9tricas-y-logging)
14. [EPIC-12 · Testing y QA](#epic-12--testing-y-qa)
15. [EPIC-13 · DevOps y Despliegue](#epic-13--devops-y-despliegue)
16. [Mapa de Dependencias](#mapa-de-dependencias)
17. [Estimación Global](#estimaci%C3%B3n-global)

---

## 1. Decisiones de Arquitectura

### Off-Chain: Monolito Modular NestJS

Se adopta **arquitectura monolítica modular con NestJS** para el backend off-chain. Cada agente (Orchestrator, Optimizer, Router, Judge, Workers) vive como un **módulo independiente dentro del mismo proceso NestJS/Node.js**, comunicándose por llamadas a función directas e inyección de dependencias en lugar de red. Esto reduce la complejidad operativa en las fases iniciales y permite extraer servicios independientes en Phase 2 sin cambiar las interfaces.

NestJS se usa como shell de aplicación: arranque HTTP, lifecycle hooks, dependency injection, controllers y composición de módulos. La lógica de negocio sigue la arquitectura hexagonal: `domain/` no depende de Nest ni de SDKs externos; los decorators de Nest viven en controllers, adapters o archivos `<module>.module.ts`.

```
apps/
└── agent-server/          ← proceso único NestJS / Node.js (TypeScript)
    ├── modules/
    │   ├── optimizer/     ← Token Optimization Pipeline
    │   ├── router/        ← Router Agent
    │   ├── judge/         ← Judge Agent
    │   ├── orchestrator/  ← Orchestrator Agent
    │   ├── workers/       ← Worker Agents (Researcher, Analyzer, Executor, Validator)
    │   └── x402/          ← Capa de micropagos HTTP
    ├── shared/
    │   ├── solana/        ← cliente RPC, keypairs, suscripciones WS
    │   ├── llm/           ← cliente unificado Anthropic / OpenAI / Gemini
    │   └── db/            ← Redis + Postgres/pgvector
    ├── app.module.ts      ← composición global NestJS
    └── main.ts            ← NestFactory bootstrap
```

El módulo `workers/researcher` y `workers/analyzer` se implementan también en **Python** como subprocesos gestionados por el servidor Node.js mediante `child_process` / `grpc-lite`, dado que las bibliotecas de NLP y análisis de datos son más maduras en ese ecosistema.

### On-Chain: Arquitectura Anchor con PDA Jerárquico

Se sigue el patrón estándar de Solana: **un programa por dominio**, cada uno desplegado como cuenta ejecutable independiente. Las cuentas de estado son **PDAs (Program Derived Addresses)** derivadas de seeds semánticos que garantizan unicidad y permiten CPI (Cross-Program Invocations) sin firma del propietario.

```
programs/
├── agent-registry/        ← Anchor — directorio de agentes
├── task-escrow/           ← Anchor — ciclo de vida de pagos y subtareas
├── consensus/             ← Anchor — validación M-de-N
└── reputation-ledger/     ← Pinocchio — ledger append-only optimizado
```

### Frontend: Next.js 14 App Router

Single Page Application con **App Router**, renderizado del lado del servidor para páginas públicas (marketplace de agentes, explorador de tareas) y componentes cliente para la dApp interactiva. Integración con wallets Solana vía `@solana/wallet-adapter`.

---

## 2. Estructura del Repositorio

```
agentmesh/
├── apps/
│   ├── agent-server/          # Monolito modular NestJS (TypeScript)
│   └── web/                   # Frontend Next.js 14
├── programs/
│   ├── agent-registry/        # Rust / Anchor
│   ├── task-escrow/           # Rust / Anchor
│   ├── consensus/             # Rust / Anchor
│   └── reputation-ledger/     # Rust / Pinocchio
├── packages/
│   ├── sdk/                   # SDK TypeScript cliente
│   ├── idl/                   # IDL generados por Anchor (compartidos)
│   └── shared-types/          # Tipos TypeScript compartidos
├── workers-py/
│   ├── researcher/            # Python agent
│   └── analyzer/              # Python agent
├── scripts/
│   ├── deploy-devnet.sh
│   ├── seed-agents.ts
│   ├── eval-optimizer.ts
│   └── post-task.ts
├── tests/
│   ├── programs/              # Tests Anchor
│   ├── integration/           # Tests e2e
│   └── fixtures/
├── docs/
├── Anchor.toml
├── Cargo.toml
├── package.json               # Workspace root (npm)
└── turbo.json                 # Turborepo
```

---

## EPIC-01 · Setup e Infraestructura Base

**Objetivo:** Dejar el entorno de desarrollo completamente operativo para que todos los miembros del equipo puedan trabajar desde el primer día.

**Labels GitLab:** `epic::setup`, `priority::p0`

---

### ISSUE-01-01 · Configurar monorepo con npm workspaces y Turborepo

**Labels:** `area::infra`, `type::setup`
**Estimación:** 0.5 días

**Descripción:**
Inicializar el monorepo con npm workspaces y Turborepo para gestionar dependencias y pipelines de build compartidos.

**Tareas:**
- [ ] Inicializar `package.json` raíz con `workspaces: ["apps/*", "packages/*"]`
- [ ] Configurar `package.json (workspaces field)`
- [ ] Instalar y configurar `turbo.json` con pipelines `build`, `test`, `lint`, `dev`
- [ ] Configurar `.npmrc` y `.nvmrc` (Node 20)
- [ ] Agregar `engines` field en todos los `package.json`
- [ ] Verificar que `npm install` desde raíz instala todo correctamente

**Criterios de aceptación:**
- `npm run build` desde raíz compila todos los paquetes en orden correcto
- `npm run dev` levanta agent-server y web en paralelo

---

### ISSUE-01-02 · Configurar toolchain Rust y Solana

**Labels:** `area::blockchain`, `type::setup`
**Estimación:** 0.5 días

**Descripción:**
Instalar y versionar todas las herramientas necesarias para desarrollo on-chain.

**Tareas:**
- [ ] Documentar versiones exactas: Rust 1.89+, Solana CLI 1.18+, Anchor CLI 0.30+
- [ ] Crear `.tool-versions` (asdf) o `rust-toolchain.toml`
- [ ] Configurar `Anchor.toml` con `[programs.devnet]` vacíos (se llenarán tras deploy)
- [ ] Configurar `Cargo.toml` workspace con todos los programas como members
- [ ] Crear wallet de desarrollo Devnet y documentar proceso de airdrop
- [ ] Verificar `anchor build` compila sin errores
- [ ] Agregar `anchor test` al pipeline de CI

**Criterios de aceptación:**
- `anchor build` produce artefactos `.so` para los 4 programas
- `solana airdrop 5` funciona en Devnet desde la wallet configurada

---

### ISSUE-01-03 · Configurar linting, formatting y pre-commit hooks

**Labels:** `area::infra`, `type::setup`
**Estimación:** 0.5 días

**Descripción:**
Establecer estándares de código consistentes en todo el repositorio.

**Tareas:**
- [ ] Configurar ESLint + Prettier para TypeScript (apps y packages)
- [ ] Configurar `clippy` para Rust con `#![deny(clippy::all)]`
- [ ] Instalar `husky` + `lint-staged` para pre-commit
- [ ] Configurar `commitlint` con conventional commits
- [ ] Agregar `.editorconfig`
- [ ] Configurar Black + isort para Python (workers-py)
- [ ] Documentar en README cómo instalar los hooks

**Criterios de aceptación:**
- Un commit con código mal formateado es rechazado automáticamente
- `npm run lint` retorna 0 en un repo limpio

---

### ISSUE-01-04 · Provisionar infraestructura de datos off-chain

**Labels:** `area::infra`, `type::setup`
**Estimación:** 1 día

**Descripción:**
Levantar Redis (Semantic Cache) y PostgreSQL con extensión pgvector (RAG store + datos operacionales) en Docker Compose para desarrollo local.

**Tareas:**
- [ ] Crear `docker-compose.yml` con servicios: `redis`, `postgres` (pgvector 0.5+), `pgadmin`
- [ ] Configurar `postgres` con extensión `vector` habilitada en `init.sql`
- [ ] Crear schema inicial: tablas `tasks`, `agents`, `subtasks`, `optimizer_metrics`
- [ ] Configurar `prisma` como ORM (schema + migraciones iniciales)
- [ ] Crear `packages/shared-types/src/db.ts` con tipos generados por Prisma
- [ ] Documentar variables de entorno requeridas en `.env.example`
- [ ] Script `scripts/db-reset.sh` para desarrollo

**Criterios de aceptación:**
- `docker-compose up -d` levanta todos los servicios sin errores
- `prisma migrate dev` aplica el schema inicial correctamente
- Conexión Redis funciona con `redis-cli ping`

---

### ISSUE-01-05 · Configurar gestión de secretos y variables de entorno

**Labels:** `area::infra`, `type::setup`
**Estimación:** 0.5 días

**Descripción:**
Establecer un sistema seguro y consistente para gestionar API keys y configuración sensible.

**Tareas:**
- [ ] Definir todas las variables de entorno requeridas en `.env.example` con descripciones
- [ ] Configurar `zod` para validación de env vars al inicio del proceso (`env.ts`)
- [ ] Variables requeridas: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `REDIS_URL`, `DATABASE_URL`, `SOLANA_RPC_URL`, `SOLANA_WS_URL`, `AGENT_KEYPAIR_PATH`
- [ ] Configurar `dotenv` con soporte para `.env.local` (no commiteado)
- [ ] Documentar cómo obtener cada key en `docs/setup.md`
- [ ] Agregar `.env*` (excepto `.env.example`) al `.gitignore`

**Criterios de aceptación:**
- El proceso falla rápido con mensaje claro si falta alguna variable requerida
- `.env.example` tiene todas las variables documentadas

---

### ISSUE-01-06 · Configurar cliente LLM unificado

**Labels:** `area::ai`, `type::setup`
**Estimación:** 1 día

**Descripción:**
Crear una capa de abstracción sobre los proveedores LLM (Anthropic, OpenAI, Google) que permita al Router seleccionar modelos sin acoplar el código al proveedor.

**Tareas:**
- [ ] Crear `apps/agent-server/shared/llm/client.ts` con interfaz `LLMClient`
- [ ] Implementar `AnthropicProvider` (claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-6)
- [ ] Implementar `OpenAIProvider` (gpt-4.1-mini, gpt-4.1, gpt-5) — stub inicial
- [ ] Implementar `GoogleProvider` (gemini-flash-2.0, gemini-pro-2.5) — stub inicial
- [ ] Configurar retry logic con exponential backoff (3 intentos, 1s/2s/4s)
- [ ] Configurar rate limiting por proveedor
- [ ] Agregar métricas: tokens usados, latencia, proveedor, modelo
- [ ] Integrar Anthropic Prompt Cache en `AnthropicProvider`

**Interfaz objetivo:**
```typescript
interface LLMClient {
  complete(req: CompletionRequest): Promise<CompletionResponse>
  // CompletionRequest: { model, messages, systemPrompt, maxTokens, temperature }
  // CompletionResponse: { content, inputTokens, outputTokens, cachedTokens, latencyMs }
}
```

**Criterios de aceptación:**
- Se puede cambiar el modelo de una llamada modificando solo el campo `model`
- Las métricas de tokens se registran en cada llamada
- Los reintentos funcionan correctamente ante errores 429

---

## EPIC-02 · Programas Solana On-Chain

**Objetivo:** Implementar los 4 programas Anchor/Pinocchio que forman la base económica y de consenso de AgentMesh.

**Labels GitLab:** `epic::onchain`, `priority::p0`

**Prerequisito:** EPIC-01 completo

---

### ISSUE-02-01 · Agent Registry — Estructura de cuentas y registro

**Labels:** `area::blockchain`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el programa `agent_registry` con la estructura de datos on-chain y la instrucción de registro de agentes.

**Estructura de cuenta `AgentAccount` (PDA: `["agent", owner_pubkey]`):**
```rust
pub struct AgentAccount {
    pub owner: Pubkey,              // wallet que recibe pagos
    pub capabilities: u64,          // bitmap de capacidades
    pub supported_tiers: u8,        // bitmap: 0b001=simple, 0b010=medium, 0b100=complex
    pub price_per_task: u64,        // en lamports
    pub reputation_score: i16,      // -100 a +100
    pub total_tasks: u32,
    pub successful_tasks: u32,
    pub routing_rules: RoutingRules,
    pub agent_class: AgentClass,    // Worker | Router | Judge | Optimizer | Validator
    pub is_active: bool,
    pub registered_at: i64,
    pub bump: u8,
}
```

**Tareas:**
- [ ] Definir `AgentAccount`, `RoutingRules`, `AgentClass` y `CapabilityBitmap` en `state.rs`
- [ ] Implementar instrucción `register_agent(ctx, params: RegisterAgentParams)`
- [ ] Validar que el bitmap de capacidades sea consistente con la clase del agente
- [ ] Emitir evento `AgentRegistered { agent, owner, class, capabilities }`
- [ ] Tests unitarios: registro exitoso, registro duplicado (debe fallar), bitmap inválido

**Criterios de aceptación:**
- Un agente puede registrarse con una wallet y sus PDAs son derivables deterministicamente
- El registro de un agente ya existente falla con error específico `AgentAlreadyRegistered`

---

### ISSUE-02-02 · Agent Registry — Actualización, routing rules y slashing

**Labels:** `area::blockchain`, `type::feature`
**Estimación:** 1.5 días

**Descripción:**
Implementar las instrucciones de gestión del ciclo de vida del agente post-registro.

**Tareas:**
- [ ] Instrucción `update_capabilities(ctx, new_capabilities: u64)` — solo owner
- [ ] Instrucción `set_routing_rules(ctx, rules: RoutingRules)` — solo owner
- [ ] Instrucción `deactivate_agent(ctx)` — solo owner
- [ ] Instrucción `slash_reputation(ctx, agent: Pubkey, amount: i16, reason: SlashReason)` — solo programas autorizados (Consensus)
- [ ] Instrucción `get_agents_by_capability(ctx, capability_mask: u64)` — solo lectura
- [ ] Lógica de filtrado: agentes con `reputation_score < threshold` no son retornados
- [ ] Tests: slashing lleva score a mínimo pero no por debajo de -100, solo Consensus puede slash

**Criterios de aceptación:**
- Un agente con reputación < -50 no aparece en queries de reclutamiento
- Solo el programa `consensus` puede llamar `slash_reputation` via CPI

---

### ISSUE-02-03 · Task Escrow — Creación y estructura jerárquica de subtareas

**Labels:** `area::blockchain`, `type::feature`
**Estimación:** 2.5 días

**Descripción:**
Implementar el programa `task_escrow` con la estructura de árbol jerárquico de subtareas y la instrucción de creación.

**Estructura de cuentas:**
```rust
// PDA: ["task", creator_pubkey, task_id]
pub struct TaskAccount {
    pub creator: Pubkey,
    pub task_id: u64,
    pub brief_hash: [u8; 32],       // SHA-256 del brief completo
    pub total_budget: u64,           // lamports bloqueados
    pub allocated_budget: u64,
    pub status: TaskStatus,          // Pending | Active | Completed | Disputed | Cancelled
    pub orchestrator: Option<Pubkey>,
    pub created_at: i64,
    pub timeout_slots: u64,
    pub bump: u8,
}

// PDA: ["subtask", task_pubkey, subtask_index]
pub struct SubtaskAccount {
    pub task: Pubkey,
    pub parent_subtask: Option<Pubkey>,
    pub worker: Option<Pubkey>,
    pub allocated_budget: u64,
    pub max_retry_spend: u64,
    pub declared_tier: Tier,         // Simple | Medium | Complex
    pub result_hash: Option<[u8; 32]>,
    pub status: SubtaskStatus,
    pub timeout_slot: u64,
    pub bump: u8,
}
```

**Tareas:**
- [ ] Definir todas las structs y enums en `state.rs`
- [ ] Instrucción `create_task(ctx, task_id, brief_hash, budget, timeout_slots)` — bloquea fondos en PDA
- [ ] Instrucción `assign_orchestrator(ctx, orchestrator_pubkey)` — solo creator
- [ ] Instrucción `allocate_subtask(ctx, subtask_index, parent, budget, max_retry_spend)`
- [ ] Validar que la suma de budgets de subtareas no exceda el total
- [ ] Tests: creación con fondos insuficientes falla, asignación correcta de presupuesto

**Criterios de aceptación:**
- Los fondos quedan bloqueados en el PDA del task al crearlo
- No se puede asignar más presupuesto del disponible en el task

---

### ISSUE-02-04 · Task Escrow — Ejecución, reintentos y liberación de pagos

**Labels:** `area::blockchain`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el ciclo de vida completo de ejecución de una subtarea, incluyendo declaración de tier, entrega de resultado, reintentos y liberación de pago.

**Tareas:**
- [ ] Instrucción `declare_tier(ctx, subtask, tier, worker)` — Router registra tier antes de ejecutar
- [ ] Instrucción `submit_result(ctx, subtask, result_hash)` — Worker entrega resultado
- [ ] Instrucción `complete_subtask(ctx, subtask)` — Consensus llama tras M-de-N firmas; transfiere lamports al worker via CPI
- [ ] Instrucción `retry_subtask(ctx, subtask, new_tier, new_worker)` — Judge escala tier
- [ ] Instrucción `claim_timeout_refund(ctx, subtask)` — si `slot > timeout_slot` y no hay resultado, re-subasta
- [ ] CPI a `reputation_ledger` al completar cada subtarea
- [ ] Emit eventos: `TierDeclared`, `ResultSubmitted`, `SubtaskCompleted`, `SubtaskRetried`, `TimeoutClaimed`
- [ ] Tests end-to-end: flujo completo simple → medium retry → complete

**Criterios de aceptación:**
- El pago al worker solo ocurre después de que Consensus llama `complete_subtask`
- Un retry no puede exceder `max_retry_spend` definido al crear la subtarea
- El timeout re-subasta automáticamente sin intervención humana

---

### ISSUE-02-05 · Consensus — Validación M-de-N y sistema de disputas

**Labels:** `area::blockchain`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el programa `consensus` que previene que un actor único apruebe su propio trabajo.

**Estructura:**
```rust
// PDA: ["consensus", subtask_pubkey]
pub struct ConsensusAccount {
    pub subtask: Pubkey,
    pub required_signatures: u8,    // M
    pub total_validators: u8,        // N
    pub signatures: Vec<ValidatorSig>,
    pub status: ConsensusStatus,     // Pending | Approved | Disputed | Vetoed
    pub dispute_deadline_slot: u64,
    pub bump: u8,
}
```

**Tareas:**
- [ ] Instrucción `initialize_consensus(ctx, subtask, required_sigs, validators)`
- [ ] Instrucción `submit_validation(ctx, subtask, approved: bool, justification_hash)`
- [ ] Lógica: cuando `approved_count >= required_sigs` → llamar CPI `task_escrow::complete_subtask`
- [ ] Instrucción `dispute_result(ctx, subtask)` — solo creator del task, dentro del grace period
- [ ] Instrucción `veto_result(ctx, subtask)` — solo creator, marca para revisión humana
- [ ] CPI a `agent_registry::slash_reputation` cuando validador aprueba trabajo luego refutado
- [ ] Tests: 2-de-3, 3-de-5, veto dentro y fuera del grace period, slash automático

**Criterios de aceptación:**
- El pago no puede liberarse sin M firmas de N validadores distintos
- Un validador no puede firmar dos veces la misma subtarea
- El worker no puede ser también validador de su propia subtarea

---

### ISSUE-02-06 · Reputation Ledger — Registro append-only y scoring

**Labels:** `area::blockchain`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el programa `reputation_ledger` usando Pinocchio para máxima eficiencia. Es un log inmutable de outcomes por agente.

**Diseño:**
- Cada agente tiene una cuenta `ReputationAccount` (PDA: `["rep", agent_pubkey]`)
- Los outcomes se acumulan como entradas en un circular buffer on-chain de tamaño fijo (últimas 100 tareas)
- El score se recalcula con ventana deslizante ponderada (tareas recientes tienen más peso)

**Tareas:**
- [ ] Implementar con Pinocchio (sin Anchor overhead) para minimizar compute units
- [ ] Instrucción `record_outcome(ctx, agent, task, success, score, tier_used)`
- [ ] Instrucción `record_tier_accuracy(ctx, router_agent, predicted_tier, actual_tier_needed, retry_happened)`
- [ ] Instrucción `query_score(ctx, agent)` — retorna score actual
- [ ] Algoritmo de scoring: promedio ponderado con decay exponencial (tareas más recientes ×2)
- [ ] Instrucción `export_credential(ctx, agent)` — prepara datos para NFT de reputación (Phase 2 stub)
- [ ] Tests: score cero agente nuevo, score mejora con éxitos, score cae con fallos, no se puede sobreescribir

**Criterios de aceptación:**
- El ledger es verdaderamente append-only: ninguna instrucción puede modificar registros históricos
- La consulta de score cuesta menos de 5,000 compute units

---

### ISSUE-02-07 · IDL compartidos y cliente Anchor TypeScript

**Labels:** `area::blockchain`, `area::sdk`, `type::feature`
**Estimación:** 1 día

**Descripción:**
Publicar los IDL generados por Anchor como paquete interno y crear el cliente TypeScript para que el monolito off-chain interactúe con los programas.

**Tareas:**
- [ ] Configurar `anchor build` para exportar IDL a `packages/idl/src/`
- [ ] Crear `packages/idl/package.json` con tipos generados
- [ ] Crear `apps/agent-server/shared/solana/programs.ts` con instancias `Program<T>` de Anchor
- [ ] Crear helpers: `createTask()`, `allocateSubtask()`, `declareTimer()`, `submitResult()`, `registerAgent()`
- [ ] Crear suscripciones WebSocket a eventos de cada programa
- [ ] Configurar connection pool para RPC (evitar rate limits)

**Criterios de aceptación:**
- El servidor off-chain puede llamar cualquier instrucción on-chain sin escribir serialización manual
- Los eventos on-chain disparan callbacks en el monolito en menos de 500ms

---

## EPIC-03 · Pipeline de Optimización de Tokens

**Objetivo:** Implementar el pipeline pre-inferencia de 6 etapas que reduce el costo de cada llamada LLM entre 40-47%.

**Labels GitLab:** `epic::optimizer`, `priority::p1`

**Prerequisito:** ISSUE-01-04, ISSUE-01-06

---

### ISSUE-03-01 · Semantic Cache con Redis

**Labels:** `area::optimizer`, `type::feature`
**Estimación:** 1.5 días

**Descripción:**
Implementar la primera etapa del pipeline: cache semántico que retorna respuestas anteriores cuando la similitud coseno supera el umbral configurado.

**Tareas:**
- [ ] Crear `modules/optimizer/semantic-cache.ts`
- [ ] Al recibir una query: generar embedding con `text-embedding-3-small` (OpenAI) o `voyage-3` (Anthropic)
- [ ] Buscar en Redis usando `FT.SEARCH` con índice vectorial (Redis Stack / RediSearch)
- [ ] Si similitud coseno ≥ 0.97: retornar respuesta cacheada + métricas de ahorro
- [ ] Si miss: continuar pipeline, al final guardar `(embedding, response_summary, metadata)`
- [ ] TTL configurable por tipo de tarea (default: 3600s para investigación, 300s para DeFi)
- [ ] Métricas: `cache_hit_rate`, `tokens_saved_by_cache`, `avg_similarity_on_hit`
- [ ] Tests: hit exacto, hit por similitud, miss, expiración de TTL

**Criterios de aceptación:**
- Una query idéntica retorna en < 10ms (vs 2-5s sin cache)
- El threshold de 0.97 no produce hits falsos en el set de test de 200 queries

---

### ISSUE-03-02 · Intent Classifier y Skill Matching

**Labels:** `area::optimizer`, `type::feature`
**Estimación:** 1 día

**Descripción:**
Clasificar la intención de la query y verificar si existe un template precompilado que la sirva exactamente, evitando la llamada al modelo principal.

**Tareas:**
- [ ] Crear `modules/optimizer/intent-classifier.ts`
- [ ] Usar Haiku para clasificar: `{ intent, needs_docs, complexity_hint, skill_id? }`
- [ ] Crear biblioteca de skills en Postgres: `id`, `name`, `template`, `capability_mask`, `example_queries`
- [ ] Implementar `modules/optimizer/skill-matcher.ts`: buscar skill por embedding similarity ≥ 0.95
- [ ] Si match exacto (≥ 0.98): retornar template renderizado con variables de la query
- [ ] Si match parcial (0.95-0.97): marcar como `partial_match`, continuar pipeline pero informar al Router
- [ ] Si no hay match: continuar pipeline normalmente
- [ ] Seed inicial de skills: `market-research`, `code-review`, `defi-arbitrage`, `data-analysis`, `text-summary`

**Criterios de aceptación:**
- El classifier no modifica el contenido de la query, solo lo analiza
- Un match exacto evita completamente la llamada al modelo worker

---

### ISSUE-03-03 · RAG Search con pgvector

**Labels:** `area::optimizer`, `type::feature`
**Estimación:** 1.5 días

**Descripción:**
Implementar búsqueda en base de conocimiento vectorial para agregar contexto relevante a las queries que lo requieren.

**Tareas:**
- [ ] Crear `modules/optimizer/rag-search.ts`
- [ ] Schema Postgres: tabla `knowledge_chunks` con columna `embedding vector(1536)`
- [ ] Índice HNSW para búsqueda aproximada eficiente (`CREATE INDEX ... USING hnsw`)
- [ ] Búsqueda: `topK=5`, `minScore=0.70`, retornar chunks + scores
- [ ] Ingestion pipeline: `scripts/ingest-knowledge.ts` para cargar documentos en el vector store
- [ ] Tipos de documentos iniciales: documentación de protocolos DeFi, APIs públicas comunes
- [ ] Integración con el pipeline: solo ejecutar RAG si `intent.needs_docs === true`

**Criterios de aceptación:**
- La búsqueda de los 5 chunks más relevantes tarda < 100ms
- Los chunks recuperados tienen score ≥ 0.70 (no se agregan chunks irrelevantes)

---

### ISSUE-03-04 · Context Pruning conservador

**Labels:** `area::optimizer`, `type::feature`
**Estimación:** 1 día

**Descripción:**
Eliminar contenido redundante o de baja relevancia del contexto antes de enviarlo al modelo.

**Tareas:**
- [ ] Crear `modules/optimizer/context-pruning.ts`
- [ ] Deduplicación: calcular similitud coseno entre todos los chunks; eliminar si similitud ≥ 0.90
- [ ] Filtro de relevancia: eliminar chunks con score < 0.30 respecto a la query original
- [ ] Preservar siempre el chunk más reciente en caso de duplicados con el mismo contenido
- [ ] Registrar en métricas: `chunks_before`, `chunks_after`, `tokens_eliminated`
- [ ] Tests: conjunto de 10 chunks donde 3 son duplicados → output de 7 chunks

**Criterios de aceptación:**
- Solo se eliminan chunks claramente redundantes (umbral conservador)
- Nunca se elimina el único chunk relevante si hay solo uno con score suficiente

---

### ISSUE-03-05 · Prompt Cache (Anthropic prefix caching)

**Labels:** `area::optimizer`, `type::feature`
**Estimación:** 0.5 días

**Descripción:**
Integrar el prefix caching nativo de Anthropic para cachear el system prompt del agente entre llamadas.

**Tareas:**
- [ ] Estructurar todos los system prompts de agentes con la parte estática primero (cacheable)
- [ ] Agregar `cache_control: { type: "ephemeral" }` en los mensajes marcados para cache
- [ ] Registrar en métricas: `cached_tokens`, `cache_creation_tokens`, `cache_hit` por llamada
- [ ] Verificar en tests que llamadas consecutivas con el mismo system prompt muestran `cached_tokens > 0`
- [ ] Documentar el patrón de structuración de prompts para el equipo

**Criterios de aceptación:**
- Las llamadas consecutivas del mismo agente usan tokens cacheados (visible en `usage.cache_read_input_tokens`)
- El ahorro de tokens en system prompts es ≥ 50% después del primer warm-up

---

### ISSUE-03-06 · Orquestador del pipeline y evaluación de degradación

**Labels:** `area::optimizer`, `type::feature`
**Estimación:** 1.5 días

**Descripción:**
Implementar el orquestador que ejecuta las etapas del pipeline en orden y el sistema de evaluación obligatoria antes de activar técnicas en producción.

**Tareas:**
- [ ] Crear `modules/optimizer/pipeline.ts` — orquestador principal
- [ ] Exponer `TokenOptimizer.run(query): Promise<{ processedQuery, metrics }>` como interfaz pública
- [ ] Métricas finales: `originalTokens`, `processedTokens`, `reduction%`, `techniquesApplied`, `estimatedQualityRisk`, `latencyMs`
- [ ] Implementar `scripts/eval-optimizer.ts`:
  - Cargar 200+ queries del fixture `tests/fixtures/representative-queries.json`
  - Correr cada query con y sin cada técnica individual
  - Calcular similitud semántica entre respuestas (embeddings)
  - Reportar: `avgSimilarity`, `minSimilarity`, `safe: boolean` (threshold 0.95)
- [ ] Flags de feature por técnica (env var): `ENABLE_SEMANTIC_CACHE`, `ENABLE_RAG`, etc.
- [ ] Tests del orquestador con mocks de cada etapa

**Criterios de aceptación:**
- `eval-optimizer.ts` produce un reporte claro de qué técnicas son seguras para producción
- El pipeline completo corre en < 500ms para queries típicas (excluyendo RAG si no hay docs)

---

## EPIC-04 · Router Agent

**Objetivo:** Implementar el agente clasificador que asigna cada query al tier de modelo correcto usando él mismo un modelo barato.

**Labels GitLab:** `epic::router`, `priority::p1`

**Prerequisito:** EPIC-03, ISSUE-02-03

---

### ISSUE-04-01 · Lógica de clasificación de complejidad

**Labels:** `area::agents`, `type::feature`
**Estimación:** 1.5 días

**Descripción:**
Implementar la lógica de clasificación que determina el tier apropiado para cada query procesada por el optimizer.

**Tareas:**
- [ ] Crear `modules/router/classifier.ts`
- [ ] Usar `claude-haiku-4-5` para clasificar (costo < $0.001/decisión)
- [ ] Prompt del Router: evaluar `complexity_score (0-1)`, `token_estimate`, `reasoning_required`, `context_length`
- [ ] Reglas de tier (configurables por operador en Agent Registry):
  - Simple: complexity ≤ 0.3, tokens estimados ≤ 50, sin razonamiento multi-paso
  - Medio: complexity 0.3-0.7, síntesis, código, análisis de documentos
  - Complejo: complexity > 0.7, razonamiento profundo, contexto largo, brief ambiguo
- [ ] Output: `{ tier, modelId, budgetSlice, reasoning }`
- [ ] Leer `routing_rules` del Agent Registry on-chain para el agente Router específico
- [ ] Tests: 20 queries de ejemplo distribuidas entre los 3 tiers

**Criterios de aceptación:**
- El Router clasifica correctamente el 85%+ de queries del test set
- El costo del Router por clasificación nunca supera $0.002

---

### ISSUE-04-02 · Integración con Task Escrow y declaración de tier

**Labels:** `area::agents`, `area::blockchain`, `type::feature`
**Estimación:** 1 día

**Descripción:**
Integrar el Router con el Task Escrow para registrar on-chain el tier declarado antes de ejecutar la subtarea.

**Tareas:**
- [ ] Llamar `task_escrow::declare_tier` tras clasificar, antes de reclutar al worker
- [ ] Asignar `budgetSlice` del presupuesto disponible en el escrow
- [ ] Registrar `modelId` en la cuenta de la subtarea para auditoría
- [ ] Si el presupuesto restante no alcanza para el tier clasificado: degradar al tier anterior + emitir `budget_warning`
- [ ] Si no alcanza para ningún tier: emitir flag `insufficient_budget` y devolver al creator

**Criterios de aceptación:**
- Cada subtarea tiene su tier declarado on-chain antes de que el worker empiece a ejecutar
- El override por presupuesto está documentado en los logs y es auditable on-chain

---

### ISSUE-04-03 · Router Agent como proceso registrado on-chain

**Labels:** `area::agents`, `area::blockchain`, `type::feature`
**Estimación:** 0.5 días

**Descripción:**
Registrar el Router Agent en el Agent Registry con su clase y capacidades correctas.

**Tareas:**
- [ ] Generar keypair dedicado para el Router Agent
- [ ] Script `scripts/register-router-agent.ts` que llama `agent_registry::register_agent` con clase `AgentClass::Router`
- [ ] Configurar `routing_rules` en el registro: umbrales de complejidad por tier
- [ ] Agregar el Router al script `scripts/seed-agents.ts`
- [ ] El proceso Node.js carga el keypair del Router al arrancar

**Criterios de aceptación:**
- El Router está registrado en Devnet con su keypair correcto
- Las `routing_rules` del registro se leen al inicio y se usan para clasificar

---

## EPIC-05 · Judge Agent

**Objetivo:** Implementar el agente evaluador de calidad que decide si una respuesta es suficientemente buena o debe reintentarse en un tier superior.

**Labels GitLab:** `epic::judge`, `priority::p1`

**Prerequisito:** EPIC-04

---

### ISSUE-05-01 · Motor de evaluación de calidad

**Labels:** `area::agents`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar la lógica de scoring que evalúa la calidad de una respuesta contra el brief original.

**Tareas:**
- [ ] Crear `modules/judge/evaluator.ts`
- [ ] Usar `claude-sonnet-4-6` para evaluación (tier medio, buena capacidad de crítica)
- [ ] Prompt del Judge: evaluar 4 dimensiones con peso configurable:
  - Completitud (¿aborda todas las partes del brief?)
  - Consistencia interna (¿las afirmaciones son coherentes?)
  - Cumplimiento de formato (¿el output coincide con la estructura requerida?)
  - Confianza apropiada (¿el modelo expresa incertidumbre donde corresponde?)
- [ ] Output: `{ score: number, passed: boolean, dimensions: DimensionScores, retryTier?: Tier }`
- [ ] Threshold configurable por tipo de tarea (default: 0.75)
- [ ] Tests: 10 respuestas buenas + 10 malas → clasificación correcta en ≥ 90%

**Criterios de aceptación:**
- El Judge produce un score entre 0 y 1 con justificación por dimensión
- Una respuesta que pasa el threshold no dispara un retry

---

### ISSUE-05-02 · Lógica de retry y escalado de tier

**Labels:** `area::agents`, `type::feature`
**Estimación:** 1 día

**Descripción:**
Implementar la decisión de retry y la coordinación con el Router para escalar al tier superior.

**Tareas:**
- [ ] Si `score < threshold` y `budgetRemaining >= cost_of_next_tier`:
  - Llamar `task_escrow::retry_subtask` con `new_tier`
  - Llamar `router.reassign({ tier: retryTier, subtaskId })`
  - Registrar el retry en métricas
- [ ] `maxRetries = 1` por defecto (máximo un escalado por subtarea)
- [ ] Si `score < threshold` y sin presupuesto: emitir `low_confidence` flag, devolver mejor respuesta disponible
- [ ] Registrar en `reputation_ledger`: tier declarado vs tier que realmente se necesitó
- [ ] Tests: retry exitoso al tier superior, sin presupuesto emite flag correcto

**Criterios de aceptación:**
- El retry nunca excede `max_retry_spend` de la subtarea
- El flag `low_confidence` es visible en el output final al usuario

---

### ISSUE-05-03 · Judge Agent registrado on-chain

**Labels:** `area::agents`, `area::blockchain`, `type::feature`
**Estimación:** 0.5 días

**Tareas:**
- [ ] Generar keypair dedicado para Judge Agent
- [ ] Script de registro con clase `AgentClass::Judge`
- [ ] Configurar threshold de score y maxRetries como `routing_rules` en el registro
- [ ] Agregar al `seed-agents.ts`

---

## EPIC-06 · Orchestrator Agent

**Objetivo:** Implementar el agente coordinador que descompone las tareas en árboles de subtareas y gestiona el ciclo de vida de cada worker.

**Labels GitLab:** `epic::orchestrator`, `priority::p1`

**Prerequisito:** EPIC-04, EPIC-05

---

### ISSUE-06-01 · Descomposición de tareas en árbol de subtareas

**Labels:** `area::agents`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar la lógica de descomposición que toma el brief de una tarea y genera el árbol jerárquico de subtareas.

**Tareas:**
- [ ] Crear `modules/orchestrator/task-decomposer.ts`
- [ ] Usar `claude-sonnet-4-6` para descomponer: prompt que genera JSON estructurado con subtareas
- [ ] Schema de output del decomposer:
  ```typescript
  interface SubtaskTree {
    subtasks: Array<{
      id: string, description: string, dependencies: string[],
      estimatedTier: Tier, estimatedBudget: number,
      requiredCapabilities: string[], agentClass: AgentClass
    }>
  }
  ```
- [ ] Validar que el árbol de dependencias no tenga ciclos
- [ ] Validar que el presupuesto total estimado no supere el budget del task
- [ ] Guardar el árbol en Postgres + registrar cada subtarea on-chain con `allocate_subtask`
- [ ] Tests: tarea simple (1 subtarea), tarea media (3 subtareas), tarea compleja (5+ subtareas con deps)

**Criterios de aceptación:**
- El árbol de dependencias es válido (sin ciclos, sin referencias a subtareas inexistentes)
- El presupuesto estimado por el decomposer no excede el budget total del task

---

### ISSUE-06-02 · Reclutamiento de workers del registro on-chain

**Labels:** `area::agents`, `type::feature`
**Estimación:** 1.5 días

**Descripción:**
Implementar el proceso de selección de workers basándose en capacidades, reputación y disponibilidad.

**Tareas:**
- [ ] Crear `modules/orchestrator/worker-recruiter.ts`
- [ ] Query al Agent Registry: filtrar por `capability_mask & required_mask === required_mask`
- [ ] Filtrar por `reputation_score >= min_reputation` (configurable, default: -10)
- [ ] Ordenar candidatos por `reputation_score DESC, price_per_task ASC`
- [ ] Para agentes locales (mismo proceso): selección directa
- [ ] Para agentes remotos (Phase 2): proceso de oferta on-chain
- [ ] Timeout de reclutamiento: si ningún agente disponible en 30s → escalar error

**Criterios de aceptación:**
- El recruiter siempre selecciona el agente con mejor reputación para cada subtarea
- Agentes con reputación < umbral nunca son seleccionados

---

### ISSUE-06-03 · Coordinación de ejecución paralela y secuencial

**Labels:** `area::agents`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el motor de ejecución que respeta las dependencias del árbol de subtareas y maximiza la paralelización.

**Tareas:**
- [ ] Crear `modules/orchestrator/execution-engine.ts`
- [ ] Topological sort del árbol de dependencias para determinar orden de ejecución
- [ ] Ejecutar en paralelo todas las subtareas sin dependencias pendientes
- [ ] Usar `Promise.allSettled` para manejar failures parciales sin abortar el task
- [ ] Suscribirse a eventos on-chain (`SubtaskCompleted`) para avanzar el árbol
- [ ] Gestionar estado del árbol en Postgres (qué subtareas están `pending`, `running`, `done`, `failed`)
- [ ] Al completarse todas las subtareas: llamar `task_escrow` para liberar comisión del Orchestrator
- [ ] Tests: árbol de 4 subtareas con 2 paralelas y 2 secuenciales

**Criterios de aceptación:**
- Las subtareas sin dependencias se ejecutan en paralelo (no secuencialmente)
- El failure de una subtarea no aborta subtareas independientes

---

### ISSUE-06-04 · Suscripción a eventos Solana y gestión de timeouts

**Labels:** `area::agents`, `area::blockchain`, `type::feature`
**Estimación:** 1 día

**Tareas:**
- [ ] Suscribir a `program_subscribe` via WebSocket RPC para los 4 programas
- [ ] Parsear eventos usando los tipos generados por Anchor IDL
- [ ] Al detectar `TimeoutClaimed`: marcar subtarea como fallida, buscar nuevo worker, re-asignar
- [ ] Implementar heartbeat: el worker actualiza un timestamp cada 30s; si no hay update en 2min → trigger timeout
- [ ] Lógica de re-subasta: seleccionar siguiente candidato del Recruiter

---

### ISSUE-06-05 · Orchestrator registrado on-chain y comisión

**Labels:** `area::agents`, `area::blockchain`, `type::feature`
**Estimación:** 0.5 días

**Tareas:**
- [ ] Registrar Orchestrator en Agent Registry con clase `AgentClass::Worker` y capabilities `ORCHESTRATION`
- [ ] Definir comisión del Orchestrator: 10-15% del presupuesto total (configurable)
- [ ] La comisión se reserva al crear el task y se libera al completarse la última subtarea

---

## EPIC-07 · Worker Agents

**Objetivo:** Implementar los 4 tipos de worker agents que ejecutan las subtareas concretas.

**Labels GitLab:** `epic::workers`, `priority::p1`

**Prerequisito:** EPIC-06

---

### ISSUE-07-01 · Interfaz base de Worker Agent

**Labels:** `area::agents`, `type::feature`
**Estimación:** 1 día

**Descripción:**
Crear la clase base y el contrato que deben cumplir todos los worker agents.

**Tareas:**
- [ ] Crear `modules/workers/base-worker.ts` con interfaz `WorkerAgent`
- [ ] Métodos requeridos: `canHandle(capabilities: u64): boolean`, `execute(subtask: SubtaskContext): Promise<WorkerResult>`, `getCapabilities(): u64`
- [ ] `SubtaskContext`: brief, tier asignado, budget disponible, keypair de la wallet del worker
- [ ] `WorkerResult`: `{ resultHash, resultData, tokensUsed, cost, confidence }`
- [ ] Al terminar `execute()`: llamar `task_escrow::submit_result` automáticamente
- [ ] Gestión de keypairs: cada worker tiene su wallet Solana con fondos para gas
- [ ] Logging estructurado: todas las acciones del worker loggean con `subtask_id` como contexto

**Criterios de aceptación:**
- Todos los workers implementan la interfaz sin modificar el código del Orchestrator
- El submit del resultado on-chain es automático y no requiere código extra en cada worker

---

### ISSUE-07-02 · Researcher Agent (TypeScript + Python subprocess)

**Labels:** `area::agents`, `type::feature`
**Estimación:** 2.5 días

**Descripción:**
Implementar el agente de investigación que realiza búsquedas web y consume APIs externas mediante micropagos x402.

**Tareas:**
- [ ] Crear `modules/workers/researcher/researcher-agent.ts` — coordinador TS
- [ ] Crear `workers-py/researcher/researcher.py` — motor de búsqueda Python
- [ ] Capacidades: `RESEARCH | WEB_SEARCH | DATA_COLLECTION`
- [ ] Herramientas: búsqueda web (DuckDuckGo API, Bing API), scraping ético (Playwright headless), APIs de datos financieros
- [ ] Integración x402: usar `x402-client` para pagar APIs que requieren micropago
- [ ] Consolidar resultados: múltiples fuentes → resumen estructurado con citas
- [ ] Usar Claude Haiku/Sonnet (según tier) para síntesis final
- [ ] Subprocess IPC: JSON over stdin/stdout entre TS y Python
- [ ] Tests: research de un protocolo DeFi, research de un mercado específico

**Criterios de aceptación:**
- El Researcher puede pagar una API x402 externa automáticamente sin configuración manual
- Los resultados incluyen fuentes citadas y un hash de verificabilidad

---

### ISSUE-07-03 · Analyzer Agent (Python)

**Labels:** `area::agents`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el agente de análisis de datos que procesa outputs del Researcher y genera insights estructurados.

**Tareas:**
- [ ] Crear `workers-py/analyzer/analyzer.py`
- [ ] Capacidades: `ANALYSIS | DATA_PROCESSING | REPORT_GENERATION`
- [ ] Herramientas: pandas (análisis de datos tabulares), matplotlib (generación de gráficos base64), numpy (estadística)
- [ ] Tipos de análisis: análisis de tendencias, comparación de datasets, generación de reportes ejecutivos
- [ ] Output estructurado: JSON con `summary`, `key_findings`, `charts_base64[]`, `raw_data_hash`
- [ ] Usar Claude Sonnet/Opus (según tier) para interpretación y redacción
- [ ] Tests: análisis de dataset financiero de ejemplo, generación de reporte ejecutivo

---

### ISSUE-07-04 · Executor Agent (TypeScript — DeFi)

**Labels:** `area::agents`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el agente de ejecución para operaciones DeFi en Solana.

**Tareas:**
- [ ] Crear `modules/workers/executor/executor-agent.ts`
- [ ] Capacidades: `EXECUTION | DEFI | SWAP`
- [ ] Integrar Pyth Network para precios en tiempo real (oracles on-chain)
- [ ] Integrar Jupiter Aggregator SDK para swaps con mejor precio
- [ ] Integrar Raydium SDK para operaciones de liquidez
- [ ] Validación pre-ejecución: verificar slippage, liquidez, límites de presupuesto
- [ ] El Executor nunca ejecuta sin aprobación del Risk Agent (Consensus M-de-N)
- [ ] Simulación de transacción antes de ejecutar (`simulateTransaction`)
- [ ] Tests: simulación de swap (sin ejecutar en Devnet sin fondos reales), cálculo de slippage

**Criterios de aceptación:**
- Ninguna transacción DeFi se ejecuta sin pasar por Consensus
- El Executor simula antes de ejecutar y aborta si la simulación falla

---

### ISSUE-07-05 · Validator Agent (TypeScript)

**Labels:** `area::agents`, `type::feature`
**Estimación:** 1.5 días

**Descripción:**
Implementar el agente validador que firma el consenso después de verificar la calidad del trabajo de otros workers.

**Tareas:**
- [ ] Crear `modules/workers/validator/validator-agent.ts`
- [ ] Capacidades: `VALIDATION | QUALITY_ASSURANCE`
- [ ] Al recibir request de validación: leer `result_hash` del escrow, recuperar resultado de Postgres
- [ ] Usar Claude Sonnet para verificación independiente contra el brief original
- [ ] Si aprueba: llamar `consensus::submit_validation` con firma
- [ ] Si rechaza: llamar `consensus::submit_validation` con `approved: false` + justificación hash
- [ ] El Validator lleva registro de sus votos (no puede votar dos veces la misma subtarea)
- [ ] Tests: validación correcta de resultado bueno, rechazo de resultado malo, prevención de doble voto

**Criterios de aceptación:**
- El Validator nunca puede ser el mismo agente que el Worker que produjo el resultado
- El rechazo incluye una justificación hasheada verificable

---

## EPIC-08 · Capa de Pagos x402

**Objetivo:** Implementar el cliente y servidor x402 para micropagos HTTP automáticos entre agentes y hacia APIs externas.

**Labels GitLab:** `epic::x402`, `priority::p1`

**Prerequisito:** ISSUE-01-02

---

### ISSUE-08-01 · Cliente x402 para consumo de APIs externas

**Labels:** `area::x402`, `type::feature`
**Estimación:** 1.5 días

**Descripción:**
Implementar el cliente x402 que intercepta respuestas HTTP 402 y paga automáticamente usando la wallet del agente.

**Tareas:**
- [ ] Crear `modules/x402/client.ts` — wrapper sobre `fetch` con interceptor 402
- [ ] Al recibir 402: parsear el header `X-Payment-Payload` con los detalles del micropago
- [ ] Construir y firmar la transacción Solana correspondiente
- [ ] Enviar la transacción y esperar confirmación (timeout: 2s máximo)
- [ ] Re-intentar la request original con el header `X-Payment-Proof`
- [ ] Integrar con el `x402-solana-client` de la especificación x402.org
- [ ] Registrar cada micropago: `amount`, `destination`, `api_url`, `subtask_id`
- [ ] Tests con mock server que simula respuestas 402

**Criterios de aceptación:**
- El flujo completo (recibir 402 → pagar → recibir respuesta) tarda < 1.5s en Devnet
- El cliente maneja gracefully un 402 donde el precio pedido supera el budget del agente

---

### ISSUE-08-02 · Servidor x402 para APIs internas de AgentMesh

**Labels:** `area::x402`, `type::feature`
**Estimación:** 1 día

**Descripción:**
Implementar el middleware x402 que permite monetizar las APIs internas de AgentMesh (acceso a resultados, datos de reputación premium, índices RAG).

**Tareas:**
- [ ] Crear `modules/x402/server-middleware.ts` — Express/Fastify middleware
- [ ] Al recibir request sin proof: responder 402 con payload de pago en Solana
- [ ] Al recibir request con proof: verificar transacción on-chain, continuar con el handler
- [ ] Cache de proofs verificados (evitar re-verificación de la misma tx)
- [ ] Endpoints que usarán x402: `/api/results/:task_id`, `/api/reputation/:agent`, `/api/rag/query`
- [ ] Tests: request sin proof → 402, request con proof válido → 200, proof ya usado → 402

---

### ISSUE-08-03 · Gestión de wallets de agentes y fondos para gas

**Labels:** `area::x402`, `area::blockchain`, `type::feature`
**Estimación:** 1 día

**Tareas:**
- [ ] Sistema de keypairs por agente: cada agente tiene su wallet en `~/.agentmesh/keys/<agent_id>.json`
- [ ] Monitor de balance: si balance < 0.1 SOL, emitir alerta `low_agent_balance`
- [ ] Auto-funding en Devnet: si balance < 0.05 SOL, hacer airdrop automático (solo Devnet)
- [ ] En Mainnet: funding manual + alertas a operador
- [ ] Separación clara: wallet del agente (gas + x402) vs wallet del propietario (recibe pagos de tasks)

---

## EPIC-09 · SDK Cliente

**Objetivo:** Publicar un SDK TypeScript que permita a dApps externas integrar AgentMesh sin conocer los detalles internos.

**Labels GitLab:** `epic::sdk`, `priority::p2`

**Prerequisito:** EPIC-02 al 80%, EPIC-08

---

### ISSUE-09-01 · SDK core — publicación de tareas y consulta de estado

**Labels:** `area::sdk`, `type::feature`
**Estimación:** 2 días

**Tareas:**
- [ ] Crear `packages/sdk/src/index.ts` con clase `AgentMeshClient`
- [ ] `AgentMeshClient.postTask(brief, budget, wallet)` → `TaskHandle`
- [ ] `TaskHandle.waitForCompletion()` → suscripción WebSocket al progreso
- [ ] `TaskHandle.getStatus()` → estado actual del task y sus subtareas
- [ ] `TaskHandle.getResult()` → resultado final + cost breakdown
- [ ] `TaskHandle.cancel()` → cancelar si aún no está en ejecución
- [ ] Tipos exportados: `Task`, `Subtask`, `AgentInfo`, `CostBreakdown`, `TaskResult`
- [ ] Publicar como `@agentmesh/sdk` en registry interno GitLab

---

### ISSUE-09-02 · SDK — registro de agentes externos

**Labels:** `area::sdk`, `type::feature`
**Estimación:** 1 día

**Tareas:**
- [ ] `AgentMeshClient.registerAgent(config, wallet)` → registra en Agent Registry
- [ ] `AgentMeshClient.queryAgents(capabilities)` → lista agentes disponibles
- [ ] `AgentMeshClient.getAgentReputation(agentPubkey)` → consulta Reputation Ledger
- [ ] Documentación completa con ejemplos de código

---

### ISSUE-09-03 · SDK — Rust helpers para CPI on-chain

**Labels:** `area::sdk`, `area::blockchain`, `type::feature`
**Estimación:** 1 día

**Tareas:**
- [ ] Crear `packages/sdk-rust/` con helpers CPI para programas externos que quieran integrar AgentMesh
- [ ] Exportar `cpi::register_agent`, `cpi::post_task`, `cpi::query_reputation`
- [ ] Publicar como crate en el registry interno

---

## EPIC-10 · Frontend — dApp Next.js

**Objetivo:** Implementar la interfaz web completa de AgentMesh: publicación de tareas, marketplace de agentes, monitoreo en tiempo real y panel de reputación.

**Labels GitLab:** `epic::frontend`, `priority::p1`

**Prerequisito:** EPIC-09 al 50%

---

### ISSUE-10-01 · Setup Next.js 14 App Router y design system

**Labels:** `area::frontend`, `type::setup`
**Estimación:** 1 día

**Tareas:**
- [ ] Inicializar `apps/web` con Next.js 14 App Router + TypeScript
- [ ] Configurar Tailwind CSS + design tokens (colores, tipografía, spacing)
- [ ] Instalar y configurar `@solana/wallet-adapter-react` + `@solana/wallet-adapter-wallets`
- [ ] Crear componentes base: `Button`, `Card`, `Badge`, `Spinner`, `Modal`, `Toast`
- [ ] Configurar `zustand` para estado global del cliente
- [ ] Configurar `react-query` / `tanstack-query` para fetching de datos
- [ ] Layout raíz: header con wallet connect, navegación, footer
- [ ] Configurar `next-themes` para dark/light mode

---

### ISSUE-10-02 · Página de publicación de tareas

**Labels:** `area::frontend`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el flujo completo para que un usuario publique una tarea, conecte su wallet y bloquee fondos en el escrow.

**Tareas:**
- [ ] Ruta: `/tasks/new`
- [ ] Formulario multi-step:
  - Step 1: Descripción del objetivo (textarea con conteo de tokens estimado)
  - Step 2: Configuración de presupuesto (slider en SOL/USDC + estimación de costo)
  - Step 3: Opciones avanzadas (timeout, tier mínimo, agentes preferidos)
  - Step 4: Confirmación + firma de transacción con wallet
- [ ] Preview en tiempo real del costo estimado basado en la complejidad del brief
- [ ] Integración con `@agentmesh/sdk` para crear el task on-chain
- [ ] Feedback post-creación: link a la página de monitoreo del task
- [ ] Manejo de errores: fondos insuficientes, wallet no conectada, RPC error

**Criterios de aceptación:**
- El usuario puede crear un task en menos de 3 clics después de redactar el brief
- Los errores de transacción se muestran con mensajes comprensibles (no raw Solana errors)

---

### ISSUE-10-03 · Dashboard de monitoreo de tasks en tiempo real

**Labels:** `area::frontend`, `type::feature`
**Estimación:** 2.5 días

**Descripción:**
Implementar el panel de control donde el usuario ve el progreso de su task en tiempo real.

**Tareas:**
- [ ] Ruta: `/tasks/[taskId]`
- [ ] Vista de árbol de subtareas con estado visual (`pending`, `running`, `completed`, `failed`)
- [ ] Para cada subtarea: agente asignado, tier declarado, score del Judge, costo
- [ ] Métricas del optimizer en tiempo real: tokens ahorrados, técnicas activas
- [ ] Feed de eventos en tiempo real via WebSocket (eventos del servidor)
- [ ] Indicador de `low_confidence` cuando el Judge no puede escalar por presupuesto
- [ ] Visualización del costo total acumulado vs budget total
- [ ] Al completarse: resultado final expandible + desglose detallado de costos
- [ ] Botón de disputa (disponible durante grace period)

---

### ISSUE-10-04 · Marketplace de agentes

**Labels:** `area::frontend`, `type::feature`
**Estimación:** 2 días

**Descripción:**
Implementar el explorador público del Agent Registry donde cualquiera puede ver los agentes disponibles.

**Tareas:**
- [ ] Ruta: `/agents`
- [ ] Lista de agentes con filtros: por capacidad, clase, tier, reputación mínima
- [ ] Ordenamiento: por reputación, precio, número de tasks completados
- [ ] Tarjeta de agente: score de reputación, capabilities, precio, estadísticas
- [ ] Ruta: `/agents/[agentPubkey]` — perfil detallado
  - Historial de tasks (on-chain, público)
  - Gráfico de evolución de reputación
  - Precisión de tier (para Router Agents)
  - Distribución de tipos de tarea
- [ ] Integración con Reputation Ledger via SDK

---

### ISSUE-10-05 · Panel de registro de nuevo agente

**Labels:** `area::frontend`, `type::feature`
**Estimación:** 1.5 días

**Tareas:**
- [ ] Ruta: `/agents/register`
- [ ] Formulario: clase de agente, capacidades (checkboxes con descripción), precio, routing rules
- [ ] Validación: no se puede registrar sin wallet conectada
- [ ] Generación guiada de keypair del agente (descargable como JSON cifrado)
- [ ] Preview del bitmap de capacidades que se almacenará on-chain
- [ ] Confirmación de transacción + redirect al perfil del agente

---

### ISSUE-10-06 · Explorador de transacciones y auditoría on-chain

**Labels:** `area::frontend`, `type::feature`
**Estimación:** 1.5 días

**Tareas:**
- [ ] Ruta: `/explorer`
- [ ] Feed de tasks recientes en Devnet/Mainnet
- [ ] Para cada task: timeline completo on-chain (creación, subtareas, pagos, consenso)
- [ ] Links directos al explorador de Solana (Solscan/Explorer) para cada tx
- [ ] Filtros: por estado, por agente, por presupuesto
- [ ] Estadísticas globales: total tasks, total pagado, ahorro de tokens acumulado, agentes activos

---

### ISSUE-10-07 · Panel de usuario — mis tasks y mis agentes

**Labels:** `area::frontend`, `type::feature`
**Estimación:** 1.5 días

**Tareas:**
- [ ] Ruta: `/dashboard`
- [ ] Tab "Mis Tasks": tasks publicados con estado actual + historial
- [ ] Tab "Mis Agentes": agentes registrados bajo mi wallet
  - Para cada agente: earnings totales, reputación actual, tasks activos
  - Botón para actualizar capacidades o routing rules
- [ ] Tab "Estadísticas": gasto total, ahorro total por optimizer, tarea más cara, tier más usado
- [ ] Conectar wallet para ver datos personales

---

### ISSUE-10-08 · Componente de desglose de costos

**Labels:** `area::frontend`, `type::feature`
**Estimación:** 1 día

**Descripción:**
Crear el componente reutilizable que muestra el desglose detallado de costos de un task.

**Tareas:**
- [ ] Componente `CostBreakdown`:
  - Costo total pagado
  - Por subtarea: tier usado, modelo, tokens (originales / después de optimizer), costo
  - Ahorro total gracias al optimizer (en $ y en %)
  - Micropagos x402 pagados a APIs externas
  - Comisión del Orchestrator
  - Fees on-chain (gas Solana)
- [ ] Visualización: gráfico de barras apiladas por categoría de costo
- [ ] Exportable como CSV

---

## EPIC-11 · Observabilidad, Métricas y Logging

**Objetivo:** Tener visibilidad completa del sistema en producción.

**Labels GitLab:** `epic::observability`, `priority::p2`

---

### ISSUE-11-01 · Logging estructurado con contexto de tarea

**Labels:** `area::infra`, `type::feature`
**Estimación:** 1 día

**Tareas:**
- [ ] Configurar `pino` como logger en el monolito
- [ ] Todos los logs incluyen: `task_id`, `subtask_id`, `agent_id`, `module`, `timestamp`
- [ ] Niveles de log: `debug` (desarrollo), `info` (producción), `error` siempre
- [ ] Log rotation y retención configurable
- [ ] En Python: configurar `structlog` con el mismo formato JSON

---

### ISSUE-11-02 · Métricas de negocio y performance

**Labels:** `area::infra`, `type::feature`
**Estimación:** 1 día

**Tareas:**
- [ ] Métricas a recolectar (Prometheus / OpenTelemetry):
  - `agentmesh_tokens_saved_total` — contador de tokens ahorrados por el optimizer
  - `agentmesh_task_duration_seconds` — histograma de duración de tasks
  - `agentmesh_tier_distribution` — distribución de llamadas por tier
  - `agentmesh_judge_retry_rate` — % de subtareas que requirieron retry
  - `agentmesh_cache_hit_rate` — hit rate del semantic cache
  - `agentmesh_x402_payments_total` — total de micropagos procesados
- [ ] Exponer `/metrics` endpoint en el servidor
- [ ] Dashboard Grafana (o similar) con las métricas principales

---

### ISSUE-11-03 · Alertas operacionales

**Labels:** `area::infra`, `type::feature`
**Estimación:** 0.5 días

**Tareas:**
- [ ] Alertas críticas: balance de wallet de agente < 0.05 SOL, tasa de error > 5%, Devnet RPC timeout
- [ ] Alertas de negocio: task sin completar en > 2x timeout esperado
- [ ] Integración con canal de Slack/Discord para alertas

---

## EPIC-12 · Testing y QA

**Objetivo:** Garantizar la calidad y correctitud del sistema en todos sus niveles.

**Labels GitLab:** `epic::testing`, `priority::p1`

---

### ISSUE-12-01 · Tests unitarios de programas Anchor

**Labels:** `area::testing`, `area::blockchain`, `type::test`
**Estimación:** 2 días

**Tareas:**
- [ ] Suite de tests para `agent_registry`: registro, actualización, slashing, filtrado por capabilities
- [ ] Suite de tests para `task_escrow`: creación, allocación, declare_tier, complete, retry, timeout
- [ ] Suite de tests para `consensus`: M-de-N variants (2/3, 3/5), veto, disputa, slash automático
- [ ] Suite de tests para `reputation_ledger`: record, query, ventana deslizante, append-only
- [ ] Coverage target: 90%+ de instrucciones
- [ ] Correr en Bankrun (test framework Solana rápido, sin Devnet)

---

### ISSUE-12-02 · Tests de integración del monolito

**Labels:** `area::testing`, `type::test`
**Estimación:** 2 días

**Tareas:**
- [ ] Tests del pipeline optimizer: cada técnica individualmente + pipeline completo
- [ ] Tests del Router: clasificación correcta de queries de ejemplo
- [ ] Tests del Judge: scoring correcto en respuestas buenas y malas
- [ ] Tests del Orchestrator: descomposición de tasks de ejemplo
- [ ] Mocks de LLM para tests deterministicos (no gastar tokens en cada test run)
- [ ] Mocks de Solana RPC en tests de integración off-chain

---

### ISSUE-12-03 · Test de evaluación de degradación (eval-optimizer)

**Labels:** `area::testing`, `area::ai`, `type::test`
**Estimación:** 1.5 días

**Tareas:**
- [ ] Crear `tests/fixtures/representative-queries.json` con 200+ queries reales del dominio
- [ ] Implementar `scripts/eval-optimizer.ts` completo
- [ ] Correr contra el pipeline y reportar similitud semántica por técnica
- [ ] CI gate: bloquear merge si alguna técnica activa tiene similitud < 0.95
- [ ] Documentar el proceso de añadir nuevas queries al fixture set

---

### ISSUE-12-04 · Test e2e del flujo completo

**Labels:** `area::testing`, `type::test`
**Estimación:** 2 días

**Tareas:**
- [ ] Test e2e: publicar un task de investigación de mercado en Devnet local
- [ ] Verificar: optimizer reduce tokens, Router clasifica correctamente, Judge aprueba, Consensus firma, pago liberado, Reputation actualizado
- [ ] Test e2e con retry: diseñar task donde el primer intento falle el Judge
- [ ] Test e2e de timeout: simular worker que no entrega y verificar re-subasta
- [ ] Test e2e de micropago x402: verificar que el Researcher paga APIs externas

---

### ISSUE-12-05 · Tests de frontend (Cypress / Playwright)

**Labels:** `area::testing`, `area::frontend`, `type::test`
**Estimación:** 1.5 días

**Tareas:**
- [ ] Configurar Playwright para tests e2e de la web
- [ ] Test: flujo de publicación de task (con wallet mock)
- [ ] Test: visualización en tiempo real del progreso
- [ ] Test: explorador de agentes y filtrado
- [ ] Test: dashboard de usuario
- [ ] Snapshot tests para componentes críticos

---

## EPIC-13 · DevOps y Despliegue

**Objetivo:** Automatizar el ciclo de build, test y despliegue.

**Labels GitLab:** `epic::devops`, `priority::p2`

---

### ISSUE-13-01 · Pipeline CI/CD en GitLab

**Labels:** `area::devops`, `type::setup`
**Estimación:** 1.5 días

**Tareas:**
- [ ] Crear `.gitlab-ci.yml` con stages: `lint`, `build`, `test`, `deploy`
- [ ] Stage `lint`: ESLint + Prettier + Clippy + Black
- [ ] Stage `build`: `npm run build` (turbo build) + `anchor build`
- [ ] Stage `test`: `anchor test` + `npm test` + `pytest`
- [ ] Stage `eval-optimizer`: correr degradation eval (solo en main)
- [ ] Stage `deploy:devnet`: `anchor deploy` + seed agents (solo en main)
- [ ] Cache de `node_modules` y `~/.cargo` entre jobs
- [ ] Notificación de Slack en failures

---

### ISSUE-13-02 · Despliegue del monolito en servidor

**Labels:** `area::devops`, `type::setup`
**Estimación:** 1 día

**Tareas:**
- [ ] Crear `Dockerfile` multi-stage para el monolito Node.js
- [ ] Crear `Dockerfile` para workers Python
- [ ] `docker-compose.prod.yml` con todos los servicios
- [ ] Variables de entorno de producción documentadas
- [ ] Health checks para cada servicio
- [ ] Script de rollback en caso de deploy fallido
- [ ] Documentar proceso de despliegue en `docs/deployment.md`

---

### ISSUE-13-03 · Despliegue del frontend en Vercel/similar

**Labels:** `area::devops`, `area::frontend`, `type::setup`
**Estimación:** 0.5 días

**Tareas:**
- [ ] Configurar variables de entorno en plataforma de hosting
- [ ] Configurar preview deployments para MR (Merge Requests)
- [ ] Configurar dominio personalizado
- [ ] Verificar que el build de producción funciona correctamente

---

### ISSUE-13-04 · Despliegue Mainnet (Phase 2)

**Labels:** `area::devops`, `area::blockchain`, `type::feature`
**Estimación:** 2 días

**Tareas:**
- [ ] Auditoría de seguridad de programas Anchor antes de Mainnet
- [ ] Plan de migración de Devnet a Mainnet (direcciones de programas)
- [ ] Proceso de upgrade de programas Anchor (authority management)
- [ ] Funding de wallets de agentes en Mainnet
- [ ] Plan de incident response para Mainnet

---

## Mapa de Dependencias

```
EPIC-01 (Setup)
    ├── EPIC-02 (On-Chain)
    │       ├── ISSUE-02-01 → ISSUE-02-02 → ISSUE-02-07
    │       ├── ISSUE-02-03 → ISSUE-02-04
    │       └── ISSUE-02-05 → ISSUE-02-06
    ├── EPIC-03 (Optimizer)
    │       └── ISSUE-03-01..06 (secuencial)
    └── EPIC-08 (x402) — independiente

EPIC-02 + EPIC-03 →
    EPIC-04 (Router)
        └── EPIC-05 (Judge)
                └── EPIC-06 (Orchestrator)
                        └── EPIC-07 (Workers)
                                └── EPIC-08 (x402 integración)

EPIC-07 + EPIC-08 →
    EPIC-09 (SDK)
        └── EPIC-10 (Frontend)

EPIC-01..10 →
    EPIC-11 (Observabilidad) — transversal
    EPIC-12 (Testing) — transversal
    EPIC-13 (DevOps) — transversal
```

---

## Estimación Global

| Epic | Área | Días estimados |
|------|------|---------------|
| EPIC-01 · Setup | Infra | 4 |
| EPIC-02 · On-Chain | Blockchain (Rust) | 12 |
| EPIC-03 · Optimizer | Backend / IA | 7 |
| EPIC-04 · Router Agent | Backend / IA | 3 |
| EPIC-05 · Judge Agent | Backend / IA | 3.5 |
| EPIC-06 · Orchestrator | Backend | 6.5 |
| EPIC-07 · Workers | Backend / Python | 9 |
| EPIC-08 · x402 | Backend / Blockchain | 3.5 |
| EPIC-09 · SDK | Backend | 4 |
| EPIC-10 · Frontend | Frontend | 14 |
| EPIC-11 · Observabilidad | Infra | 2.5 |
| EPIC-12 · Testing | QA | 9 |
| EPIC-13 · DevOps | Infra | 5 |
| **Total** | | **87 días/persona** |

**Con 4 personas en paralelo (respetando dependencias):**
- Persona 1 — Rust/Blockchain: EPIC-02 + soporte EPIC-13
- Persona 2 — Backend TS: EPIC-03 + EPIC-04 + EPIC-05 + EPIC-06 + EPIC-09
- Persona 3 — Workers/Python: EPIC-07 + EPIC-08 + EPIC-11
- Persona 4 — Frontend: EPIC-10 + EPIC-12 (e2e frontend) + EPIC-01 (setup web)

**Duración estimada: 6-7 semanas** para la aplicación completa en equipo de 4.

---

## Etiquetas GitLab recomendadas

```
# Epics
epic::setup
epic::onchain
epic::optimizer
epic::router
epic::judge
epic::orchestrator
epic::workers
epic::x402
epic::sdk
epic::frontend
epic::observability
epic::testing
epic::devops

# Área técnica
area::blockchain
area::backend
area::ai
area::frontend
area::infra
area::x402
area::sdk
area::testing

# Tipo
type::setup
type::feature
type::test
type::bug
type::refactor
type::docs

# Prioridad
priority::p0   # bloqueante
priority::p1   # core
priority::p2   # importante
priority::p3   # nice-to-have
```

---

*Documento generado para AgentMesh · Solana · Versión aplicación completa*
