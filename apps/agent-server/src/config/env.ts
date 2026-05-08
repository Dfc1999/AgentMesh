import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  GOOGLE_API_KEY: z.string().min(1).optional(),
  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SOLANA_RPC_URL: z.string().url(),
  SOLANA_WS_URL: z.string().url(),
  AGENT_KEYPAIR_PATH: z.string().min(1),
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
