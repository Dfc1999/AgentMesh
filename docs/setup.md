# AgentMesh Setup

## Required versions

- Node.js 20+
- npm 10+
- Rust 1.89.0, pinned in `rust-toolchain.toml`
- Solana CLI 1.18+
- Anchor CLI 0.30.1
- Docker Desktop or a compatible Docker Engine
- Python 3.11+ for `workers-py`

## First install

```bash
npm install
npm run prepare
docker compose up -d
npx prisma migrate dev --schema prisma/schema.prisma --name init
```

The backend is a NestJS app:

```bash
npm run dev --workspace @agentmesh/agent-server
```

By default it listens on `http://localhost:3001` and exposes `GET /health`.

## Environment variables

Copy `.env.example` to `.env.local` and fill provider keys.

- `ANTHROPIC_API_KEY`: Claude provider key.
- `OPENAI_API_KEY`: OpenAI provider key and embeddings.
- `GOOGLE_API_KEY`: Gemini provider key.
- `REDIS_URL`: semantic cache connection string.
- `DATABASE_URL`: PostgreSQL connection string.
- `SOLANA_RPC_URL`: Solana HTTP RPC endpoint.
- `SOLANA_WS_URL`: Solana websocket endpoint.
- `AGENT_KEYPAIR_PATH`: local JSON keypair path for the development agent.

## Devnet wallet

```bash
solana config set --url devnet
solana-keygen new --outfile ./keys/devnet-agent.json
solana airdrop 5 "$(solana-keygen pubkey ./keys/devnet-agent.json)"
```

Keep `keys/` local. It is ignored by git.

## Quality checks

```bash
npm run lint
npm run build
anchor build
cargo test -p reputation-ledger
cargo clippy --workspace --all-targets
```
