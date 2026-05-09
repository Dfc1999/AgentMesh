# AgentMesh

AgentMesh is a decentralized multi-agent economy on Solana. Users post goals, fund an escrow, and autonomous AI agents optimize prompts, route work to the right model tier, execute subtasks, judge quality, validate through consensus, and settle payments on-chain.

This repository currently contains the EPIC-01 implementation from `plan-develop.md`: setup and base infrastructure. The business modules are intentionally thin, but the repo shape, contracts, toolchain, data services, NestJS backend shell, and LLM client foundation are in place for the following epics.

## What EPIC-01 Implemented

### Monorepo and Tooling

- Root npm workspace with `apps/*` and `packages/*`.
- Turborepo tasks for `build`, `dev`, `lint`, and `test`.
- Node 20 pinning through `.nvmrc`, `.tool-versions`, and `engines`.
- Shared TypeScript config in `tsconfig.base.json`.
- ESLint flat config, Prettier, EditorConfig, Husky, lint-staged, and commitlint.
- Python formatting config for Black and isort in `pyproject.toml`.

### Repository Structure

The repo follows the structure defined in the development plan and the hexagonal architecture guide:

```text
apps/
  agent-server/
    src/modules/
      optimizer/
      router/
      judge/
      orchestrator/
      workers/
      x402/
    src/shared/
      llm/
      db/
      solana/
  web/
packages/
  shared-types/
  sdk/
  idl/
programs/
  agent-registry/
  task-escrow/
  consensus/
  reputation-ledger/
workers-py/
  researcher/
  analyzer/
```

Each off-chain module exposes only its inbound port and public types through `index.ts`. Domain files do not import adapters or provider SDKs.

### Backend Runtime: NestJS

`apps/agent-server` is a NestJS application. Nest is used as the application shell for HTTP entrypoints, lifecycle hooks, dependency injection, and module composition. It does not replace the hexagonal boundaries:

- `domain/` remains framework-free business logic.
- `ports/` remain TypeScript interfaces.
- `adapters/` can use Nest decorators when they are inbound controllers or infrastructure providers.
- `<name>.module.ts` files are the Nest wiring layer where domain services receive their port implementations.

Current Nest files:

- `src/main.ts`: bootstraps `AppModule` with `NestFactory`.
- `src/app.module.ts`: imports shared infrastructure modules.
- `src/config/config.module.ts`: validates env vars once and exports the `ENV` provider.
- `src/shared/llm/llm.module.ts`: exports `LLM_CLIENT_FACTORY` for future modules.
- `src/health.controller.ts`: exposes `GET /health`.

### Solana and Rust Base

- `Anchor.toml` configured for localnet and devnet placeholders.
- Root Cargo workspace with four program members.
- Rust toolchain pinned to `1.89.0` because EPIC-02 uses Pinocchio for `reputation-ledger`.
- Placeholder Anchor programs:
  - `agent-registry`
  - `task-escrow`
  - `consensus`
  - `reputation-ledger`

These placeholders only expose `initialize`; EPIC-02 should replace them with the real account state and instructions.

### Local Data Infrastructure

- `docker-compose.yml` with Redis, PostgreSQL + pgvector, and pgAdmin.
- `infra/postgres/init.sql` enables `vector` and creates initial tables:
  - `tasks`
  - `agents`
  - `subtasks`
  - `optimizer_metrics`
  - `rag_chunks`
- Prisma schema mirrors the initial operational tables.
- `scripts/db-reset.sh` resets local Docker volumes and reapplies Prisma migrations.

### Environment and Secrets

- `.env.example` documents all required variables.
- `apps/agent-server/src/config/env.ts` validates env vars with Zod and fails fast with readable errors.
- `.gitignore` excludes `.env*` except `.env.example`, local keys, build outputs, ledgers, and caches.
- `docs/setup.md` documents local setup, devnet wallet creation, airdrop, and quality commands.

### Shared Types

`packages/shared-types` defines the contracts future modules will share:

- Agent classes and model tiers.
- Model IDs for Anthropic, OpenAI, and Gemini.
- Optimizer result and metrics.
- Router decision and routing rules.
- LLM completion request/response.
- Initial database record shapes.

### Unified LLM Client

`apps/agent-server/src/shared/llm` implements the EPIC-01 LLM abstraction and exposes it through a Nest global module:

- `LLMClient` interface.
- `LLMClientFactory` maps model IDs to providers.
- `AnthropicProvider` with optional system prompt cache control.
- `OpenAIProvider` for GPT-family models.
- `GoogleProvider` for Gemini-family models.
- Shared retry handler with 1s/2s/4s backoff.
- Simple per-provider rate limiter.
- Metrics returned on every completion: input tokens, output tokens, cached tokens, latency, provider, and model.
- `LlmModule` provider token: `LLM_CLIENT_FACTORY`.

Future modules should depend on their own outbound `ILLMClient` ports, then wire those ports to this shared client from their Nest `<module>.module.ts`.

## Setup

```bash
npm install
docker compose up -d
npx prisma migrate dev --schema prisma/schema.prisma --name init
```

Create `.env.local` from `.env.example` and fill the provider keys.

## Common Commands

```bash
npm run dev
npm run build
npm run lint
npm run test
anchor build
cargo clippy --workspace --all-targets
```

`npm run dev` starts the configured persistent workspace tasks. At this stage, `agent-server` boots a NestJS app on port `3001` and exposes `GET /health`, while `web` is only a minimal Next.js shell reserved for EPIC-10.

## Notes for the Next Epic

- EPIC-02 should replace the placeholder Anchor programs with real state, instructions, events, and tests.
- Keep the module boundaries from `AgentMesh_Arquitectura_Hexagonal.md`: domain imports ports and shared types only.
- NestJS decorators belong in controllers, Nest modules, or infrastructure providers. Do not put framework decorators in domain classes unless the team intentionally relaxes the hexagonal rule.
- When adding adapters, keep provider SDKs inside `adapters/` or `shared/` infrastructure, not in module domain code.
- The `reputation-ledger` program is implemented with Pinocchio in EPIC-02, so it does not generate an Anchor IDL. Client serializers/readers should be added in the EPIC-02 integration issue.
- Program IDs are placeholder system IDs. Replace them after keypair generation or deployment.
