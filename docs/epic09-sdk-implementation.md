# EPIC 09 - SDK Cliente

## Estado

EPIC 09 queda implementado con tres piezas:

- SDK TypeScript publico en `packages/sdk`.
- Gateway backend NestJS en `apps/agent-server/src/modules/sdk-gateway` para endpoints de soporte al SDK/frontend.
- Helpers Rust en `packages/sdk-rust` para preparar integraciones CPI de programas externos.

El objetivo principal es que EPIC 10 pueda construir el frontend usando `@agentmesh/sdk` sin conocer los detalles internos del backend, los modulos NestJS o los programas Solana.

## SDK TypeScript

Archivo principal:

```text
packages/sdk/src/index.ts
```

Exporta:

- `AgentMeshClient`
- `TaskHandle`
- `AgentMeshHttpError`
- Tipos publicos: `Task`, `Subtask`, `AgentInfo`, `CostBreakdown`, `TaskResult`, `RegisterAgentConfig`, `QueryAgentsFilter`, `AgentReputation`, `WalletLike`, `Tier`, `ModelId`, `AgentClass`.

### Configuracion

```ts
const client = new AgentMeshClient({
  apiBaseUrl: "http://localhost:3001",
  rpcUrl: "https://api.devnet.solana.com",
});
```

`rpcUrl` queda expuesto para integraciones Solana del frontend, pero la version actual del SDK usa el backend como boundary principal.

### Crear task

```ts
const handle = await client.postTask(
  "Analyze market data and produce a decision report.",
  2_000_000n,
  wallet,
);
```

Internamente llama:

```text
POST /orchestrator/tasks
```

Body enviado:

- `creatorPubkey`
- `brief`
- `budgetLamports`
- `taskId` opcional
- `taskPda` opcional
- `routerAgentPda` opcional
- `orchestratorAgentPda` opcional
- `timeoutSlots` opcional

### Consultar estado

```ts
const task = await handle.getStatus();
```

Internamente llama:

```text
GET /orchestrator/tasks/:taskId
```

### Esperar finalizacion

```ts
const result = await handle.waitForCompletion({
  pollIntervalMs: 1500,
  timeoutMs: 120000,
  onProgress: (task) => console.log(task.status),
});
```

La implementacion intenta WebSocket si se configura `websocketUrl` y se pasa `preferWebSocket: true`. Como EPIC 11/12 todavia no tiene canal realtime oficial, el fallback funcional actual es polling HTTP.

### Resultado final y costos

```ts
const result = await handle.getResult();
```

Devuelve:

- `content`: resultados de subtareas completadas concatenados en orden.
- `costBreakdown`: presupuesto, asignado, gastado, refund estimado.
- `subtasks`: subtareas normalizadas para UI.

### Cancelacion

```ts
const cancel = await handle.cancel();
```

Internamente llama:

```text
POST /sdk/tasks/:taskId/cancel
```

Actualmente devuelve contrato funcional con `cancelled: false`, porque la cancelacion real requiere integrar `Task Escrow` cancel/close en on-chain. Esto esta listo para que el frontend muestre el estado sin romperse.

## Registro y consulta de agentes

### Registrar agente externo

```ts
const agent = await client.registerAgent(
  {
    name: "External Research Agent",
    agentClass: "worker",
    capabilities: ["research", "web_search"],
    pricePerTaskLamports: 250_000n,
    minTier: "simple",
    endpoint: "https://agent.example.com",
  },
  wallet,
);
```

Internamente llama:

```text
POST /sdk/agents
```

### Consultar agentes

```ts
const agents = await client.queryAgents({
  capabilities: ["research"],
  agentClass: "worker",
  minReputationScore: 0.8,
});
```

Internamente llama:

```text
GET /sdk/agents
```

Soporta filtros:

- `capability`
- `agentClass`
- `minReputationScore`
- `maxPricePerTaskLamports`

### Reputacion

```ts
const reputation = await client.getAgentReputation(agent.agentId);
```

Internamente llama:

```text
GET /sdk/agents/:agentId/reputation
```

## Gateway NestJS

Modulo:

```text
apps/agent-server/src/modules/sdk-gateway
```

Estructura:

- `domain/SdkGatewayService.ts`
- `domain/types.ts`
- `ports/inbound/ISdkGatewayUseCase.ts`
- `adapters/inbound/SdkGatewayController.ts`
- `sdk-gateway.module.ts`
- `index.ts`

Responsabilidades:

- Servir catalogo frontend-friendly de agentes.
- Registrar agentes externos en memoria.
- Exponer reputacion normalizada.
- Exponer contrato de cancelacion.

Importante: este gateway usa almacenamiento en memoria y agentes locales seed para desarrollo. La integracion productiva debe reemplazarlo por adapters reales contra `Agent Registry` y `Reputation Ledger`.

## Rust helpers

Crate:

```text
packages/sdk-rust
```

Exporta helpers:

- `cpi::register_agent`
- `cpi::post_task`
- `cpi::query_reputation`

La version actual genera `CpiRequest` tipados y sin dependencia directa de Anchor/Solana SDK para evitar romper la build del workspace mientras los IDL finales se estabilizan. Cuando EPIC 02 este totalmente conectado con clientes generados, este crate debe evolucionar para construir instrucciones CPI reales.

## Uso desde Frontend EPIC 10

Instanciar una vez, idealmente en un provider o hook:

```ts
import { AgentMeshClient } from "@agentmesh/sdk";

export const agentMesh = new AgentMeshClient({
  apiBaseUrl: process.env.NEXT_PUBLIC_AGENTMESH_API_URL!,
  rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL,
});
```

Flujos recomendados:

- `/tasks/new`: `client.postTask(...)`.
- `/tasks/[taskId]`: `client.createTaskHandle(taskId).getStatus()` y `waitForCompletion`.
- `/agents`: `client.queryAgents(...)`.
- Panel de agente: `client.getAgentReputation(agentId)`.

## Pendientes por dependencias posteriores

- WebSocket real de progreso: depende de observabilidad/realtime backend.
- Cancelacion real on-chain: depende de `Task Escrow` cancel/close.
- Registro real on-chain de agentes: reemplazar `SdkGatewayService` por adapter a `Agent Registry`.
- Reputacion real: reemplazar reputacion en memoria por adapter a `Reputation Ledger`.
- Publicacion en registry interno: falta configurar registry GitLab/npm en CI.

## Verificacion

Comandos usados:

```bash
npm --workspace @agentmesh/sdk run build
npm --workspace @agentmesh/sdk run lint
npm --workspace @agentmesh/agent-server run build
npm --workspace @agentmesh/agent-server run lint
npm run eval:sdk
```

Tambien se agrego:

```bash
npm run eval:sdk
```

El eval cubre:

- Crear task desde SDK.
- Consultar status.
- Esperar completion por polling.
- Obtener resultado/cost breakdown.
- Registrar agente.
- Consultar agentes.
- Consultar reputacion.
- Ejecutar contrato de cancelacion.
