import "dotenv/config";
import { z } from "zod";

const booleanEnv = z
  .enum(["true", "false", "1", "0", "yes", "no", "on", "off"])
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    return ["true", "1", "yes", "on"].includes(value);
  });

const optionalSecret = z
  .string()
  .optional()
  .transform((value) => (value?.trim() ? value.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  OPENAI_API_KEY: optionalSecret,
  GEMINI_API_KEY: optionalSecret,
  GOOGLE_API_KEY: optionalSecret,
  AGENTMESH_MODEL_PROFILE: z.enum(["gemini", "azure"]).default("gemini"),
  AZURE_OPENAI_API_KEY: optionalSecret,
  AZURE_OPENAI_ENDPOINT: optionalSecret.pipe(z.string().url().optional()),
  AZURE_OPENAI_API_VERSION: z.string().min(1).default("2024-10-21"),
  AZURE_OPENAI_DEPLOYMENT_GPT_4_1_MINI: optionalSecret,
  AZURE_OPENAI_DEPLOYMENT_GPT_4_1: optionalSecret,
  AZURE_OPENAI_DEPLOYMENT_GPT_5: optionalSecret,
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_WS_URL: z.string().url(),
  AGENT_KEYPAIR_PATH: z.string().min(1),
  ENABLE_SEMANTIC_CACHE: booleanEnv.default("true").transform(Boolean),
  ENABLE_INTENT_CLASSIFIER: booleanEnv.default("true").transform(Boolean),
  ENABLE_SKILL_MATCHING: booleanEnv.default("true").transform(Boolean),
  ENABLE_RAG: booleanEnv.default("true").transform(Boolean),
  ENABLE_CONTEXT_PRUNING: booleanEnv.default("true").transform(Boolean),
  ENABLE_PROMPT_CACHE: booleanEnv.default("true").transform(Boolean),
  ENABLE_REAL_OPTIMIZER_LLM: booleanEnv.default("false").transform(Boolean),
  OPTIMIZER_SEMANTIC_CACHE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.97),
  OPTIMIZER_SKILL_EXACT_THRESHOLD: z.coerce.number().min(0).max(1).default(0.98),
  OPTIMIZER_SKILL_PARTIAL_THRESHOLD: z.coerce.number().min(0).max(1).default(0.95),
  OPTIMIZER_RAG_TOP_K: z.coerce.number().int().positive().default(5),
  OPTIMIZER_RAG_MIN_SCORE: z.coerce.number().min(0).max(1).default(0.7),
  OPTIMIZER_PRUNING_DUPLICATE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.9),
  OPTIMIZER_PRUNING_MIN_RELEVANCE: z.coerce.number().min(0).max(1).default(0.3),
  OPTIMIZER_DEFAULT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  OPTIMIZER_DEFI_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(input);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid AgentMesh environment: ${details}`);
  }

  return parsed.data;
}
