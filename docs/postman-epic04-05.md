# Postman QA for EPIC-04 and EPIC-05

This guide validates the Router Agent and Judge Agent through deterministic QA endpoints.
The endpoints use the same domain services implemented for EPIC-04 and EPIC-05, but replace external LLM and on-chain dependencies with local mocks.

## Files

- `postman/AgentMesh_EPIC04_05.postman_collection.json`
- `postman/AgentMesh_EPIC04_05.postman_environment.json`

## Start the API

The Nest server still validates the normal app environment at startup. For local QA, these values can be dummy values except URLs and paths:

```bash
cd AgentMesh
cat > .env <<'EOF'
NODE_ENV=development
LOG_LEVEL=debug
ANTHROPIC_API_KEY=dummy-anthropic
OPENAI_API_KEY=dummy-openai
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/agentmesh
SOLANA_RPC_URL=http://localhost:8899
SOLANA_WS_URL=ws://localhost:8900
AGENT_KEYPAIR_PATH=/tmp/agentmesh-keypair.json
EOF

npm run dev --workspace @agentmesh/agent-server
```

The API should listen on `http://localhost:3001`.

## Import in Postman

1. Import `postman/AgentMesh_EPIC04_05.postman_collection.json`.
2. Import `postman/AgentMesh_EPIC04_05.postman_environment.json`.
3. Select the `AgentMesh Local QA` environment.
4. Run the full collection.

## Expected behavior

- `00 Health` returns `200`.
- `EPIC-04 Router - simple tier` returns `decision.tier = simple` and a mock `declareTierSignature`.
- `EPIC-04 Router - complex tier` returns `decision.tier = complex`.
- `EPIC-04 Router - insufficient budget` returns `warnings` containing `insufficient_budget` and does not declare a tier.
- `EPIC-05 Judge - approved` returns `result.verdict = approved`, score above `0.75`, and a mock consensus signature.
- `EPIC-05 Judge - retry` returns `result.verdict = retry` and `retryTier = medium`.
- `EPIC-05 Judge - low confidence` returns `result.verdict = low_confidence` when retry budget is too low.
- `EPIC-04 + EPIC-05 Flow - route then judge` routes a query and immediately judges a worker response.

## QA endpoints

- `POST /qa/epic04/router/classify`
- `POST /qa/epic05/judge/evaluate`
- `POST /qa/epic04-05/flow`

These endpoints are intended for local QA/Postman. Production orchestration should call the Router and Judge use cases through the application modules and real adapters.
