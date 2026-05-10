# EPIC 08 - x402 Micropayments

## Estado

EPIC 08 queda implementado en el backend NestJS bajo `apps/agent-server/src/modules/x402` siguiendo la arquitectura hexagonal del proyecto. El modulo expone puertos inbound para cliente, servidor y wallets; puertos outbound para HTTP, Solana RPC, cache de proofs, repositorio de pagos y almacenamiento de wallets; y adaptadores concretos para ejecucion local.

La implementacion actual cubre:

- Cliente x402 que hace request inicial, detecta `402`, lee `X-Payment-Payload`, paga en Solana, confirma en menos de 2 segundos y reintenta con `X-Payment-Proof`.
- Middleware/servicio servidor x402 que genera payloads de pago, valida proof, verifica pago y bloquea reuso de proofs.
- Wallets por agente en `~/.agentmesh/keys/<agent_id>.json`.
- Monitor basico de balance con auto funding en modo Devnet simulado.
- Log y repositorio en memoria de micropagos.
- Integracion inicial con `ResearcherService` del Epic 7 para que el worker pueda consumir APIs pagadas mediante el puerto x402.

## Archivos principales

- `apps/agent-server/src/modules/x402/x402.module.ts`: wiring NestJS del modulo y tokens de DI.
- `apps/agent-server/src/modules/x402/domain/X402ClientService.ts`: caso de uso cliente x402.
- `apps/agent-server/src/modules/x402/domain/X402ServerService.ts`: gate de recursos protegidos por x402.
- `apps/agent-server/src/modules/x402/domain/X402WalletService.ts`: creacion, carga, balance y funding de wallets de agentes.
- `apps/agent-server/src/modules/x402/domain/paymentCodec.ts`: encoding/decoding de payloads y proofs en base64url JSON.
- `apps/agent-server/src/modules/x402/adapters/inbound/X402Controller.ts`: endpoints de prueba y operacion.
- `apps/agent-server/src/modules/x402/adapters/outbound/*`: adaptadores HTTP, Solana simulado, cache, pagos y wallet store.
- `apps/agent-server/src/modules/workers/adapters/outbound/X402ClientAdapter.ts`: adaptador worker -> x402 use case.
- `scripts/eval-x402.ts`: evaluacion end-to-end del flujo x402 local.

## Flujo cliente

`X402ClientService.fetchWithPayment` recibe:

- `url`, `method`, `body`, `headers`.
- `maxPriceLamports` como presupuesto maximo.
- `agentId` y opcionalmente `walletKeypairPath`.
- `subtaskId` para trazabilidad del micropago.

El flujo es:

1. Hace el request HTTP normal.
2. Si la respuesta no es `402`, devuelve el resultado sin pagar.
3. Si recibe `402`, busca `x-payment-payload` o `X-Payment-Payload`.
4. Decodifica el payload y valida que `amountLamports <= maxPriceLamports`.
5. Carga o crea la wallet del agente.
6. Envia pago por el puerto `ISolanaRpc`.
7. Confirma la transaccion con timeout de `2000ms`.
8. Construye `X402PaymentProof` con `txSignature`, `payer`, `payloadHash` y `paidAt`.
9. Reintenta el request original con header `X-Payment-Proof`.
10. Registra el micropago en `IPaymentRepository`.

## Flujo servidor

`X402ServerService.protect` recibe un `X402ServerRequest` y un `X402ProtectedResource`.

Si no hay proof:

- Devuelve `status: 402`.
- Incluye un `X402PaymentPayload` con monto, destination, network, memo y expiracion.
- En `reason` devuelve el payload encoded para usarlo como header `X-Payment-Payload`.

Si hay proof:

- Decodifica el proof.
- Rechaza proofs ya usados con `IProofCache`.
- Compara `proof.payloadHash` contra el hash del payload esperado.
- Verifica la transaccion con `ISolanaRpc.verifyPayment`.
- Marca el proof como usado por 300 segundos.
- Devuelve `status: 200`.

Importante: para que la validacion de hash sea deterministica, `X402ProtectedResource` permite `expiresAt`. Si no se pasa, el servidor genera una expiracion nueva de 60 segundos.

## Wallets

`LocalAgentWalletStore` guarda wallets en:

```text
~/.agentmesh/keys/<agent_id>.json
```

La wallet local se representa como arreglo de 64 bytes generado con `crypto.randomBytes`. El `publicKey` actual se deriva localmente con SHA-256 para permitir desarrollo sin depender aun de un SDK Solana real en runtime NestJS.

`X402WalletService` usa estos umbrales:

- Balance bajo: `0.1 SOL`.
- Auto funding Devnet: si baja de `0.05 SOL`.
- Airdrop Devnet simulado: `0.5 SOL`.

En mainnet, el servicio no auto-fondea; solo deja log de balance bajo.

## Endpoints disponibles

Base controller: `/x402`.

- `POST /x402/client/fetch`: ejecuta un fetch con pago automatico si recibe `402`.
- `POST /x402/wallets/:agentId/ensure`: crea o carga wallet de agente.
- `GET /x402/payments`: lista micropagos registrados en memoria.
- `GET /x402/protected/results/:taskId`: recurso protegido de ejemplo.

Nota: el endpoint protegido devuelve un body con `statusCode: 402` y `xPaymentPayload`. Si se necesita comportamiento HTTP estricto, el siguiente paso es cambiar el controller para usar `@Res()` y setear status real `402`.

## Integracion con workers

El `ResearcherService` ya usa el puerto `IX402Client` para consumir datos pagados:

- Calcula presupuesto x402 como `budgetLamports / 20`.
- Pasa `agentId`, `subtaskId` y `walletKeypairPath`.
- El adaptador `X402ClientAdapter` llama al caso de uso real `IX402ClientUseCase`.

En `WorkersModule`, `X402Module` se importa y `WORKER_X402` se construye con `X402_CLIENT_USE_CASE`. Esto evita mantener el mock anterior dentro del modulo worker.

## Adaptadores actuales y pendientes reales

Actual:

- `NativeHttpClientAdapter` usa `fetch` nativo.
- `SimulatedSolanaRpcAdapter` simula balances, pagos, confirmacion y verificacion.
- `InMemoryProofCacheAdapter` mantiene proofs usados en memoria.
- `InMemoryPaymentRepository` mantiene micropagos en memoria.
- `LocalAgentWalletStore` persiste wallets locales.

Pendiente para integracion productiva:

- Reemplazar `SimulatedSolanaRpcAdapter` por un adapter real con Solana RPC, `@solana/kit` o cliente generado.
- Reemplazar derivacion local de public key por keypair real compatible con Solana.
- Persistir `IPaymentRepository` en base de datos.
- Mover `IProofCache` a Redis para multiples instancias.
- Mapear los endpoints definitivos de `/api/results/:task_id`, `/api/reputation/:agent` y `/api/rag/query`.

## Dependencias con epics posteriores

EPIC 9 o el epic que implemente clientes Solana generados debe conectar `ISolanaRpc` con programas on-chain reales.

El modulo esta listo para esa integracion porque el dominio solo depende de:

- `sendPayment`
- `confirmTransaction`
- `verifyPayment`
- `getBalance`
- `requestAirdrop`

Cuando exista el cliente real:

1. Crear un nuevo adapter outbound, por ejemplo `SolanaRpcAdapter`.
2. Mantener la firma de `ISolanaRpc`.
3. Cambiar provider `X402_SOLANA_RPC` en `x402.module.ts`.
4. Correr `npm run eval:x402` y luego pruebas de integracion con Devnet.

## Como verificar

Comandos usados:

```bash
npm --workspace @agentmesh/agent-server run build
npm run eval:x402
npm run eval:workers
```

Resultado esperado de `eval:x402`:

- `paid request`: pago exitoso y respuesta `200`.
- `budget guard`: rechaza pago si supera presupuesto.
- `server proof`: proof valido permite acceso.
- `reuse proof`: proof reutilizado se rechaza con `402`.
