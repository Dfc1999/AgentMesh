# Configuracion de modelos LLM

## Estado actual

AgentMesh ya no usa Claude en la ruta activa del backend. Los modelos soportados ahora son:

- `gemini-2.5-flash-lite`
- `gpt-4.1-mini`
- `gpt-4.1`
- `gpt-5`

El perfil por defecto es Gemini:

```env
AGENTMESH_MODEL_PROFILE=gemini
GEMINI_API_KEY=...
```

Con ese perfil, Optimizer, Router, Judge, Orchestrator y Workers usan `gemini-2.5-flash-lite`.

## Por que Gemini 2.5 Flash-Lite

La documentacion oficial de Google AI lista `gemini-2.5-flash-lite` con Free Tier para input/output en la Gemini Developer API. Es el modelo mas pequeno y economico de la familia 2.5, por eso queda como default del proyecto.

Gemini 2.0 Flash tambien aparece con Free Tier, pero se eligio `gemini-2.5-flash-lite` por ser la opcion actual enfocada en costo bajo y volumen.

## Azure OpenAI

El backend ya incluye `AzureOpenAIProvider`. Para activar GPT sin tocar codigo:

```env
AGENTMESH_MODEL_PROFILE=azure
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://<resource-name>.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-10-21
AZURE_OPENAI_DEPLOYMENT_GPT_4_1_MINI=<deployment-name>
AZURE_OPENAI_DEPLOYMENT_GPT_4_1=<deployment-name>
AZURE_OPENAI_DEPLOYMENT_GPT_5=<deployment-name>
```

El routing por perfil Azure queda asi:

- Optimizer intent: `gpt-4.1-mini`
- Router: `gpt-4.1-mini`
- Worker simple: `gpt-4.1-mini`
- Judge, Orchestrator, Validator y Worker medium: `gpt-4.1`
- Worker complex: `gpt-5`

Cada `modelId` se mapea al deployment configurado en las variables `AZURE_OPENAI_DEPLOYMENT_*`.

## Seguridad

No se debe commitear ninguna API key. Si una key fue compartida en chat o logs, conviene rotarla en Google AI Studio y actualizar solo el `.env` local.
