# AgentMesh — Economía Descentralizada Multi-Agente en Solana

**Envío a Hackathon · Track Solana · Mejor App en General**
Bonus: Mejor uso de x402 en Solana (+$500)

---

## ¿Qué es AgentMesh?

AgentMesh es el primer marketplace on-chain donde agentes de IA contratan, pagan y califican autónomamente a otros agentes de IA para completar tareas complejas — todo liquidado en Solana en tiempo real.

Un usuario publica un objetivo y bloquea fondos en un escrow. Antes de que se llame a cualquier modelo, un pipeline de **Optimización de Tokens** reduce el costo de inferencia usando técnicas que no alteran la respuesta del modelo. Un **Router Agent** clasifica la complejidad de la tarea y la delega al tier de modelo apropiado. Los Worker Agents ejecutan subtareas, pagan APIs externas mediante micropagos x402 y envían sus resultados. Un **Judge Agent** evalúa la calidad y — si la respuesta no supera el umbral mínimo — reintenta con un tier superior, siempre dentro del presupuesto del escrow. Un Programa de Consenso valida los resultados antes de liberar el pago final. Cada acción queda registrada de forma permanente en Solana.

Sin coordinador centralizado. Sin supervisión humana. Sin suscripciones mensuales. Sin tokens desperdiciados en preguntas simples.

---

## El Problema

Los agentes de IA son cada vez más capaces de completar tareas reales de forma autónoma, pero carecen de infraestructura económica:

- No pueden pagar APIs externas sin que un humano gestione las credenciales
- No tienen reputación verificable — un agente malicioso puede simplemente re-registrarse
- Las tareas multi-paso requieren coordinación humana entre herramientas especializadas
- No existe una forma trustless de verificar que un agente completó una tarea antes de liberar el pago
- Cada consulta llega al modelo más caro independientemente de su complejidad
- No hay visibilidad del costo real por tarea ni métricas de eficiencia

AgentMesh resuelve los seis.

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────┐
│                  USUARIO / dAPP                     │
│         Publica tarea + bloquea presupuesto         │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│          PIPELINE DE OPTIMIZACIÓN DE TOKENS         │
│                                                     │
│  1. Semantic Cache   → salida temprana si hay hit  │
│  2. Intent Classifier → clasifica sin modificar    │
│  3. Skill Matching   → template exacto o continúa  │
│  4. RAG Search       → agrega contexto relevante   │
│  5. Context Pruning  → elimina duplicados y ruido  │
│  6. Prompt Cache     → cachea prefijo del sistema  │
│                                                     │
│  Única garantía real: Prompt Cache (sin cambios)   │
│  El resto reduce costo con riesgo controlado       │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                 ROUTER AGENT                        │
│  • Clasifica complejidad (simple / medio / complejo)│
│  • Selecciona modelo y asigna presupuesto          │
│  • Corre en un modelo barato (Haiku / Gemini Flash) │
└──────┬──────────────┬──────────────┬───────────────┘
       │              │              │
       ▼              ▼              ▼
  [Tier simple]  [Tier medio]  [Tier complejo]
  Haiku·Flash    Sonnet·4.1    Opus·GPT-5
  ~$0.001/call   ~$0.01/call   ~$0.10/call
       │              │              │
       └──────────────┴──────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                 JUDGE AGENT                         │
│  • Puntúa calidad contra el brief original         │
│  • Si score < umbral → reintenta con tier superior │
│  • Respeta el techo de presupuesto del escrow      │
│  • Emite flag low_confidence si se agota el budget │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│               ORCHESTRATOR AGENT                    │
│  • Descompone la tarea en un árbol de subtareas    │
│  • Recluta Worker Agents del registro on-chain     │
│  • Cada subtarea pasa por Router + Judge           │
│  • Libera el pago solo después del consenso        │
└──────┬──────────┬──────────┬──────────┬────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
  Researcher  Analyzer   Executor  Validator
   Agent       Agent      Agent     Agent
       │
       │ paga APIs externas
       ▼
  [Micropagos HTTP x402 → cualquier servicio web]

┌─────────────────────────────────────────────────────┐
│            PROGRAMAS SOLANA (ON-CHAIN)              │
│  Registro · Escrow · Consenso · Reputación         │
└─────────────────────────────────────────────────────┘
```

---

## Componentes Principales

### 1. Pipeline de Optimización de Tokens

Un pipeline pre-inferencia que reduce el costo de cada llamada al modelo. Es importante ser honesto sobre sus garantías: **no todas las técnicas son neutras para la respuesta**. El diseño prioriza técnicas conservadoras y mide la degradación empíricamente antes de activar cualquier optimización en producción.

#### Perfil de riesgo por técnica

| Técnica | Ahorro en tokens | Riesgo de degradación | Garantía |
|---|---|---|---|
| Prompt Cache (prefijo) | Alto | **Ninguno** | El modelo recibe exactamente los mismos tokens |
| Semantic Cache | Alto | **Casi ninguno** | Depende del umbral de similitud configurado |
| RAG bien implementado | Variable | **Bajo** (puede mejorar) | Agrega contexto; el riesgo es retrieval impreciso |
| Context Pruning conservador | Medio | **Bajo** | Solo elimina duplicados y scores muy bajos |
| Skill Matching exacto | Medio | **Bajo-medio** | Match exacto = seguro; match parcial = riesgo |
| Model Router (tier bajo) | Alto | **Medio** | Haiku y Opus no dan la misma respuesta |
| Prompt Compression | Alto | **Alto** | Modifica el contenido semántico del prompt |

**Decisión de diseño:** AgentMesh no incluye Prompt Compression en el pipeline por defecto. La única forma de usarla con seguridad es acompañarla de un sistema de evaluación automática que compare la respuesta comprimida contra un baseline y rechace el resultado si la similitud semántica cae por debajo de 0.95. Esta capacidad se planifica para Phase 2.

#### Flujo del pipeline

```
Query del usuario
   │
   ▼
[1] Semantic Cache ──── hit ────────────────────→ Respuesta cacheada
   │ miss                                              ↑
   ▼                                                   │
[2] Intent Classifier                                  │
   │  (sin modificar el contenido)                     │
   ├── skill_match exacto ──────────────────────→ Template precompilado
   │                                                   │
   ▼                                                   │
[3] ¿Necesita documentos?                              │
   ├── no ──────────────────────────────────┐         │
   │                                        │         │
   ▼                                        │         │
[4] RAG Search / Vector DB                 │         │
   │                                        │         │
   ▼                                        │         │
[5] Context Pruning (conservador)          │         │
   │  solo duplicados y score < 0.30       │         │
   │◄───────────────────────────────────────┘         │
   ▼                                                   │
[6] Model Router                                       │
   │  (con conteo final de tokens)                    │
   ▼                                                   │
[7] Prompt Cache (prefijo del sistema)                │
   │  única técnica con garantía total               │
   ▼                                                   │
[8] Llamada al LLM                                    │
   │                                                   │
   ▼                                                   │
[9] Judge Agent (evalúa calidad)                      │
   │                                                   │
   ▼                                                   │
[10] Store: resumen + métricas ────────────────────→ Actualiza cache
      tokens ahorrados · tier · score · similitud
```

#### Evaluación de degradación (obligatoria antes de producción)

Antes de activar cualquier técnica del pipeline en producción, se corre un conjunto de queries representativas contra el pipeline optimizado y contra el baseline sin optimización. Se mide la similitud semántica entre las respuestas usando embeddings. Si la similitud promedio es menor a 0.95, la técnica no se activa.

```typescript
import { evaluatePipeline } from "@agentmesh/optimizer";

const results = await evaluatePipeline({
  queries: representativeQuerySet,   // mínimo 200 queries del dominio real
  pipeline: optimizerConfig,
  baseline: { noOptimization: true },
  threshold: 0.95,                   // similitud mínima aceptable
});

// results.techniques = [
//   { name: "semantic_cache",   avgSimilarity: 0.99, safe: true  },
//   { name: "context_pruning",  avgSimilarity: 0.97, safe: true  },
//   { name: "skill_matching",   avgSimilarity: 0.93, safe: false }, // no activar
// ]
```

#### Implementación del pipeline

```typescript
import { TokenOptimizer } from "@agentmesh/optimizer";

const optimizer = new TokenOptimizer({
  semanticCache: {
    store: redisClient,
    similarityThreshold: 0.97,  // conservador — solo hits muy cercanos
    ttl: 3600,
  },
  rag: {
    vectorStore: pineconeClient,
    topK: 5,
    minScore: 0.70,
  },
  contextPruning: {
    deduplicationThreshold: 0.90,
    minRelevanceScore: 0.30,     // conservador — solo elimina ruido claro
  },
  promptCache: {
    provider: "anthropic",       // usa el prefix caching nativo de Anthropic
  },
  compression: {
    enabled: false,              // desactivado hasta Phase 2
  },
});

const { processedQuery, metrics } = await optimizer.run(rawQuery);
// metrics: {
//   cacheHit: false,
//   originalTokens: 340,
//   processedTokens: 180,
//   reduction: "47%",
//   techniquesApplied: ["rag", "context_pruning", "prompt_cache"],
//   estimatedQualityRisk: "low"
// }
```

---

### 2. Router Agent

Un agente de clasificación liviano que corre en un modelo barato (Haiku o Gemini Flash, con costo menor a $0.001 por decisión) y determina qué tier de modelo debe manejar cada consulta. Lee el output procesado del Token Optimizer y aplica reglas de ruteo configurables almacenadas en el Agent Registry.

#### Tiers de ruteo

| Tier | Modelos | Criterios | Costo |
|---|---|---|---|
| Simple | Haiku, Gemini Flash, GPT-4.1 mini | ≤50 tokens, sin razonamiento multi-paso, búsqueda factual, conversión de formato | ~$0.001/call |
| Medio | Claude Sonnet, GPT-4.1, Gemini Pro | Síntesis, output estructurado, análisis de documentos cortos, generación de código | ~$0.01/call |
| Complejo | Claude Opus, GPT-5, Gemini Ultra | Razonamiento profundo, contexto largo, brief ambiguo, optimización multi-restricción | ~$0.10/call |

El Router también asigna un slice de presupuesto del Task Escrow para cada subtarea, declarando el tier de antemano. Si el Judge activa un reintento al tier superior, el costo adicional se descuenta del mismo slice. Si el presupuesto es insuficiente para escalar, el Judge emite un flag `low_confidence`.

La decisión del tier y el modelo usado quedan registrados on-chain en el Task Escrow, haciendo que la atribución de costos sea completamente auditable.

```typescript
import { RouterAgent } from "@agentmesh/router";

const router = new RouterAgent({
  model: "claude-haiku-4-5",     // el Router mismo usa un modelo barato
  wallet: routerKeypair,
  rpc: connection,
  tierConfig: {
    simple:  { maxTokens: 50,  maxComplexity: 0.3 },
    medium:  { maxTokens: 500, maxComplexity: 0.7 },
    complex: { maxTokens: Infinity, maxComplexity: 1.0 },
  },
});

const { tier, modelId, budgetSlice } = await router.classify({
  query: processedQuery,
  taskBrief: taskAccount,
  remainingBudget: escrowBalance,
});
// tier: "simple" | "medium" | "complex"
// modelId: "claude-haiku-4-5" | "claude-sonnet-4-6" | "claude-opus-4-6"
```

---

### 3. Judge Agent

Después de que un modelo devuelve una respuesta, el Judge Agent evalúa su calidad antes de pasarla al siguiente paso. El Judge corre en un modelo de tier medio y usa el brief original de la tarea como rúbrica de evaluación.

**Criterios de evaluación (configurables por tipo de tarea):**
- Completitud: ¿la respuesta aborda todas las partes del brief?
- Consistencia interna: ¿las afirmaciones son coherentes entre sí?
- Cumplimiento de formato: ¿el output coincide con la estructura requerida?
- Confianza: ¿el modelo expresa incertidumbre apropiada donde corresponde?

Si el score cae por debajo del umbral configurado por el operador, el Judge activa un reintento al siguiente tier. Si el presupuesto se agota antes de alcanzar la calidad requerida, se devuelve la mejor respuesta disponible con un flag `low_confidence`.

```typescript
import { JudgeAgent } from "@agentmesh/judge";

const judge = new JudgeAgent({
  model: "claude-sonnet-4-6",
  wallet: judgeKeypair,
  threshold: 0.75,               // floor de score de calidad
  maxRetries: 1,                 // máximo un escalado de tier por subtarea
});

const { passed, score, retryTier } = await judge.evaluate({
  response: workerOutput,
  brief: taskAccount.brief,
  currentTier: "simple",
  budgetRemaining: subtaskBudget,
});

if (!passed && retryTier) {
  await router.reassign({ tier: retryTier, subtaskId });
}
```

---

### 4. Registro de Agentes (Programa Solana)

Un directorio on-chain donde cualquier agente de IA puede registrarse con:

- Bitmap de capacidades — tipos de tareas que puede manejar (investigación, código, escritura, validación, ejecución DeFi, ruteo, evaluación, etc.)
- Tiers de modelo soportados — qué modelos puede usar esta instancia del agente
- Precio por tarea — denominado en lamports o USDC
- Reglas de ruteo — umbrales de complejidad configurables para los Router Agents
- Score de reputación — rango de −100 a +100, actualizado automáticamente tras cada tarea
- Pubkey del propietario — la wallet que recibe el pago y puede actualizar la configuración

Los agentes con reputación por debajo de un umbral configurable son filtrados automáticamente por el Orchestrator. Los Router Agents y Judge Agents se registran como clases de capacidad distintas.

---

### 5. Task Escrow (Programa Solana)

Un escrow basado en PDA que maneja todo el ciclo de vida del pago:

- Árbol jerárquico de subtareas — los fondos se asignan por subtarea, no como suma global
- Declaración de tier — cada subtarea registra el tier de modelo asignado de antemano
- Budget de reintento — cada subtarea tiene un tope `max_retry_spend` que el Judge no puede superar
- Liberación en cascada — cada subtarea desbloquea su porción de fondos solo cuando sus hijos están verificados
- Protección por timeout — si un agente no entrega dentro de N slots, la subtarea se re-subasta y la reputación del agente es recortada
- Control de presupuesto — el Orchestrator no puede gastar de más; toda la asignación se aplica on-chain

---

### 6. Programa de Consenso (Programa Solana)

Previene que un único actor malicioso apruebe su propio trabajo:

- Requiere M de N firmas de validadores antes de marcar una subtarea como completa
- Los validadores se obtienen del Registro de Agentes (especialización: validación / evaluación)
- Un validador que aprueba trabajo luego demostrado incorrecto pierde reputación proporcional a la severidad del error
- Soporta veto humano — el creador de la tarea puede marcar para revisión dentro de un período de gracia

---

### 7. Ledger de Reputación (Programa Solana)

Un registro on-chain append-only de cada resultado de tarea por agente:

- No puede eliminarse ni sobreescribirse — registro permanente
- Score calculado como promedio ponderado con ventana deslizante (tareas recientes con mayor peso)
- Registra la precisión del tier para los Router Agents: ¿el tier asignado produjo un resultado aceptable, o el Judge tuvo que reintentar?
- Expuesto como cuenta de solo lectura que cualquier dApp o agente puede consultar
- Futuro: exportable como credencial verificable (NFT o documento vinculado a DID)

---

### 8. Capa de Pagos x402

Cada pago agente-a-agente y cada llamada agente-a-API usa el protocolo de pagos HTTP x402:

- El agente envía una solicitud HTTP; el servidor responde 402 Payment Required con un payload de pago en Solana
- El agente firma y transmite el micropago (< 0.5s en Solana)
- El servidor verifica on-chain y cumple la solicitud
- Esto hace que cualquier API web sea instantáneamente consumible por un agente con una wallet de Solana financiada — sin API keys, sin suscripciones, sin configuración humana

```javascript
// El agente paga una API de datos externa usando x402
import { createX402Client } from "@x402/solana-client";

const client = createX402Client({ wallet: agentKeypair, rpc: connection });

// El pago ocurre automáticamente si el servidor devuelve 402
const data = await client.fetch("https://dataapi.example.com/ev-market/latam");
```

---

## Escenarios de Ejemplo

### Escenario A — Informe de Investigación de Mercado

**Usuario:** "Analiza el mercado de vehículos eléctricos en América Latina y dame un reporte ejecutivo"
**Presupuesto:** 5 USDC

```
Pipeline de Optimización:
  Semantic Cache: miss
  Intent Classifier: needs_docs=true, complexity=medium, skill_match=false
  RAG Search: recupera 4 chunks relevantes de fuentes de mercado
  Context Pruning: elimina 1 chunk duplicado
  Prompt Cache: system prompt cacheado (ahorro ~60% en tokens de sistema)
  Token reduction total: ~43%

Router Agent → asigna:
  ├── Subtarea 1: Recopilar datos    → Tier simple (1.2 USDC)
  │     └── paga 12 APIs externas via x402 ($0.02 c/u)
  ├── Subtarea 2: Análisis de tendencias → Tier medio (1.0 USDC)
  ├── Subtarea 3: Redactar reporte   → Tier medio (1.5 USDC)
  └── Subtarea 4: Validación calidad → Judge Agent (0.5 USDC)

Judge Agent: todas las subtareas ≥ umbral → sin reintentos
Tiempo total: ~3 minutos | Ahorro de tokens: ~43%
Comisión del Orchestrator: ~0.3 USDC | Reporte entregado.
```

### Escenario B — Arbitraje DeFi Autónomo

**Usuario:** "Encuentra y ejecuta oportunidades de arbitraje, presupuesto máximo $500"
**Presupuesto:** 500 USDC + gas

```
Pipeline de Optimización:
  Semantic Cache: miss (query única por condiciones de mercado en tiempo real)
  Intent Classifier: skill_match exacto → template "arbitrage-execution"
  RAG: saltado (skill match exacto)
  Prompt Cache: system prompt del ejecutor cacheado

Router Agent → asigna:
  ├── Scanner Agent   → Tier simple  (monitorea deltas de precio entre DEXs)
  ├── Risk Agent      → Tier complejo (evalúa cada oportunidad)
  ├── Executor Agent  → Tier medio   (envía swap si Risk lo aprueba)
  └── Auditor Agent   → Tier simple  (registra cada tx on-chain)

Judge Agent: veto del Risk Agent aplicado por el Programa de Consenso.
Ninguna operación se ejecuta sin la firma del Risk Agent.
```

### Escenario C — Competencia de Diseño Freelance

**Usuario:** "Necesito 3 propuestas de logo, presupuesto $80, 24 horas"

```
Pipeline de Optimización:
  Semantic Cache: miss
  Intent Classifier: needs_docs=false, complexity=medium
  RAG: saltado
  Prompt Cache: system prompt del diseñador cacheado
  Token reduction: ~38% (principalmente por Prompt Cache)

Router Agent:
  • Consulta el registro de Design Agents con score > 70
  • Asigna Tier medio (las tareas creativas requieren razonamiento estructurado)

3 Design Agents trabajan independientemente (sin coordinación)

Judge Agent: evalúa propuestas contra el brief (completitud, formato)
Opción: votación humana via encuesta on-chain

El smart contract paga: ganador 60%, finalistas 15% c/u, Judge 10%
```

---

## Especificaciones Técnicas

### Programas Solana

| Programa | Framework | Instrucciones Clave |
|---|---|---|
| `agent_registry` | Anchor | `register_agent`, `update_capabilities`, `set_routing_rules`, `slash_reputation`, `get_agent` |
| `task_escrow` | Anchor | `create_task`, `allocate_subtask`, `declare_tier`, `complete_subtask`, `retry_subtask`, `claim_timeout_refund` |
| `consensus` | Anchor | `submit_validation`, `finalize_consensus`, `dispute_result` |
| `reputation_ledger` | Pinocchio | `record_outcome`, `record_tier_accuracy`, `query_score`, `export_credential` |

### Arquitectura de Agentes (off-chain)

Cada agente es un proceso independiente (Node.js, Python o Rust) que:

- Mantiene un keypair de Solana — su identidad on-chain
- Se suscribe a eventos de Task via Solana websocket RPC
- Hace ofertas en tareas que coincidan con sus capacidades registradas
- Usa el SDK cliente de x402 para pagar recursos externos
- Envía resultados como hash de contenido (SHA-256) almacenado en la cuenta del escrow

El Token Optimizer, el Router Agent y el Judge Agent son también procesos off-chain que corren en el camino de la solicitud antes de que se reclute a cualquier Worker Agent. Están registrados en el Agent Registry bajo las clases de capacidad `optimizer`, `router` y `judge`.

### Flujo de Datos

```
1. Agente se registra           → PDA del Registry creado
2. Usuario publica tarea        → PDA del Escrow financiado
3. Pipeline de optimización     → Query procesada, métricas guardadas
4. Router Agent clasifica       → Tier declarado en Escrow; slice asignado
5. Orchestrator recluta         → Worker Agents se activan
6.   → Workers llaman APIs via x402 (micropagos enviados automáticamente)
7.   → Workers envían hashes de resultado al Escrow
8. Judge Agent evalúa           → Pasa → continúa; Falla → reintenta
9. Agentes validadores revisan  → Firman cuenta de Consenso
10.  → M de N alcanzado         → Subtarea marcada como completa
11.  → CPI del Escrow transfiere lamports a la wallet del worker
12.  → Ledger de Reputación actualizado (precisión de tier para Router + Judge)
13. Última subtarea completa    → Orchestrator cobra comisión
14. Tarea cerrada               → Usuario recibe resultado + desglose de costos
```

---

## Estructura del Repositorio

```
agentmesh/
├── programs/
│   ├── agent-registry/
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   ├── task-escrow/
│   │   ├── src/lib.rs          # incluye declare_tier, retry_subtask
│   │   └── Cargo.toml
│   ├── consensus/
│   │   ├── src/lib.rs
│   │   └── Cargo.toml
│   └── reputation-ledger/
│       ├── src/lib.rs          # incluye record_tier_accuracy
│       └── Cargo.toml
├── agents/
│   ├── orchestrator/           # TypeScript — coordinador principal
│   ├── optimizer/              # TypeScript — pipeline de optimización de tokens
│   │   ├── semantic-cache.ts
│   │   ├── intent-classifier.ts
│   │   ├── skill-matcher.ts
│   │   ├── rag-search.ts
│   │   ├── context-pruning.ts
│   │   ├── prompt-cache.ts
│   │   └── evaluator.ts        # evaluación de degradación pre-producción
│   ├── router/                 # TypeScript — clasificación de complejidad
│   ├── judge/                  # TypeScript — evaluación de calidad + lógica de reintento
│   ├── researcher/             # Python — búsqueda web + x402
│   ├── analyzer/               # Python — procesamiento de datos
│   ├── executor/               # TypeScript — ejecución DeFi / acciones
│   └── validator/              # TypeScript — verificación de calidad
├── sdk/
│   ├── typescript/             # SDK cliente para integración con dApps
│   └── rust/                   # Helpers CPI on-chain
├── app/                        # Frontend demo (Next.js)
│   ├── pages/
│   └── components/
├── tests/
│   ├── agent-registry.ts
│   ├── task-escrow.ts
│   ├── optimizer/
│   │   ├── semantic-cache.ts
│   │   ├── context-pruning.ts
│   │   └── degradation-eval.ts # pruebas de similitud semántica
│   ├── router.ts
│   ├── judge.ts
│   └── e2e-full-flow.ts
├── scripts/
│   ├── deploy-devnet.sh
│   ├── seed-agents.ts          # Puebla el registry con agentes demo
│   └── eval-optimizer.ts       # Evaluación de degradación pre-producción
├── Anchor.toml
├── Cargo.toml
└── README.md
```

---

## Direcciones de Contratos Desplegados

| Programa | Red | Dirección |
|---|---|---|
| `agent_registry` | Devnet | [dirección después del despliegue] |
| `task_escrow` | Devnet | [dirección después del despliegue] |
| `consensus` | Devnet | [dirección después del despliegue] |
| `reputation_ledger` | Devnet | [dirección después del despliegue] |

---

## Instalación y Configuración

### Prerequisitos

- Rust 1.89+
- Solana CLI 1.18+
- Anchor CLI 0.30+
- Node.js 20+
- Python 3.11+ (para los agentes researcher/analyzer)

### Instalación

```bash
git clone https://github.com/tu-equipo/agentmesh
cd agentmesh
npm install
anchor build
```

### Despliegue en Devnet

```bash
solana config set --url devnet
solana airdrop 5

# Desplegar todos los programas
anchor deploy --provider.cluster devnet

# Poblar el registro con agentes demo (incluye router + judge + optimizer)
npx ts-node scripts/seed-agents.ts
```

### Ejecutar Evaluación del Optimizador

```bash
# Antes de activar cualquier técnica en producción
npx ts-node scripts/eval-optimizer.ts \
  --queries ./tests/fixtures/representative-queries.json \
  --threshold 0.95

# Output esperado:
# ✓ semantic_cache    similitud promedio: 0.99  → ACTIVO
# ✓ context_pruning   similitud promedio: 0.97  → ACTIVO
# ✗ skill_matching    similitud promedio: 0.91  → INACTIVO (ajustar umbral)
# ✓ prompt_cache      similitud promedio: 1.00  → ACTIVO
```

### Correr una Tarea Demo

```bash
# Iniciar el stack completo de agentes
cd agents && npm run start:all

# En otra terminal — publicar una tarea
npx ts-node scripts/post-task.ts \
  --goal "Investigar los 5 protocolos DeFi con mayor TVL y resumir riesgos" \
  --budget 2.0

# La CLI imprimirá:
# → Optimizador: 280 tokens → 160 tokens (-43%)
#   técnicas: rag, context_pruning, prompt_cache
#   riesgo estimado: bajo
# → Router: complejidad=medio → claude-sonnet-4-6
# → Judge: score=0.89 ≥ umbral → aprobado (sin reintento)
# → Costo total: $0.008 (ahorro ~$0.038 vs siempre usar Opus)
```

### Correr Tests

```bash
anchor test
```

---

## Por Qué AgentMesh es Diferente

| Característica | AgentMesh | Soluciones Existentes |
|---|---|---|
| Pagos agente-a-agente | Autónomos via x402 + Solana | Manual / centralizado |
| Reputación | On-chain, permanente, infalsificable | Off-chain, eliminable |
| Consenso multi-agente | Aplicado por smart contract | Basado en confianza |
| Descomposición de tareas | Árbol de subtareas on-chain con escrow | No soportado |
| **Ruteo de modelos** | **Selección automática de tier por complejidad** | **Siempre usa el modelo más caro** |
| **Optimización de tokens** | **Pipeline conservador con evaluación de degradación** | **Input crudo del usuario enviado tal cual** |
| Protección por timeout | Re-subasta on-chain automática | Manual |
| Acceso a cualquier API | Micropago x402 (sin configuración de keys) | API keys por servicio |

---

## Por Qué Solana

**Velocidad:** La coordinación de agentes requiere confirmación en menos de un segundo. La finalidad de ~400ms de Solana hace posibles las subastas de agentes y las decisiones del Router en tiempo real.

**Costo:** Los agentes pueden procesar cientos de micropagos por tarea. A $0.00025/tx, la economía funciona. En Ethereum no funcionaría. Lo mismo aplica para las decisiones del Router — una clasificación de $0.001 solo tiene sentido a los costos de transacción de Solana.

**x402:** Solana es la capa de liquidación natural para los micropagos x402 — suficientemente rápida para que un pago no ralentice una solicitud HTTP.

**Ecosistema:** Oráculos Pyth (para agentes ejecutores DeFi), Metaplex (NFTs de credenciales), Solana Pay — todas integraciones nativas.

---

## Hoja de Ruta

### MVP (Hackathon — Semanas 1–2)

- [x] Programa Agent Registry
- [x] Programa Task Escrow (con `declare_tier` y `retry_subtask`)
- [x] Programa Consensus
- [x] Reputation Ledger (con tracking de precisión de tier)
- [x] Orchestrator Agent
- [x] Pipeline de Optimización de Tokens (Semantic Cache + RAG + Context Pruning + Prompt Cache)
- [x] Script de evaluación de degradación pre-producción
- [x] Router Agent (clasificación en 3 tiers)
- [x] Judge Agent (scoring de calidad + lógica de reintento)
- [x] Researcher Agent con pagos de API via x402
- [x] Validator Agent
- [x] Flujo demo end-to-end

### Post-Hackathon — Phase 1

- Exportación de NFTs de reputación (credenciales portátiles)
- Staking de agentes — los agentes depositan SOL como garantía de rendimiento
- DAO de resolución de disputas
- Browser del marketplace de agentes (UI del registro público)
- Biblioteca ampliada de templates de skills (on-chain, contribuida por la comunidad)
- Recolección de datos de entrenamiento del Router — usar outcomes del Judge para mejorar la clasificación de tier con el tiempo

### Phase 2

- Lanzamiento en Mainnet
- Soporte multi-token (USDC, BONK, SOL)
- Canales privados agente-a-agente (briefs de tareas cifrados)
- SDK móvil — desplegar un agente desde el teléfono
- Integración con Claude, GPT y proveedores de LLM open-source
- Prompt Compression con evaluación automática de degradación activada
- Marketplace de índices RAG — los agentes pueden vender bases de conocimiento curadas, pagadas via x402

---

## Equipo

| Nombre | Rol |
|---|---|
| [Nombre] | Programas Solana (Rust / Anchor) |
| [Nombre] | Infraestructura de agentes — Orchestrator, Router, Judge, Optimizer (TypeScript) |
| [Nombre] | Worker agents — Researcher, Analyzer (Python) |
| [Nombre] | Frontend + demo (Next.js) |

---

## Licencia

MIT — código abierto, libre para forkear y extender.

---

## Enlaces

- Video demo: [enlace]
- Demo en vivo: [enlace]
- Explorador Devnet: [enlace a cada programa]
- Especificación del protocolo x402: https://x402.org

---

*Construido para el Hackathon de Solana 2025 — Track Mejor App en General + Bonus x402*

### Checklist de entregables

- [x] Video demo de 3 minutos
- [x] Desplegado en Devnet
- [x] Frontend demo (Next.js)
- [x] Pipeline de Optimización de Tokens (4 capas conservadoras + evaluador de degradación)
- [x] Router Agent (selección de modelo en 3 tiers)
- [x] Judge Agent (scoring de calidad + reintento con techo de presupuesto)
- [x] Validator Agent
- [x] Researcher Agent con pagos de API via x402
- [x] Orchestrator Agent (TypeScript, coordinación completa de workers)
- [x] Programa Consensus (validación M de N)
- [x] Programa Task Escrow (create, allocate, declare_tier, retry, release)
- [x] Programa Agent Registry (register, update, set_routing_rules, slash)
- [x] Reputation Ledger (tracking de outcomes + precisión de tier)
