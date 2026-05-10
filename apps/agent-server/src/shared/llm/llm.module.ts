import { Global, Module } from "@nestjs/common";
import { ENV } from "../../config/config.module";
import type { Env } from "../../config/env";
import { LLMClientFactory } from "./LLMClientFactory";

export const LLM_CLIENT_FACTORY = Symbol("LLM_CLIENT_FACTORY");

@Global()
@Module({
  providers: [
    {
      provide: LLM_CLIENT_FACTORY,
      inject: [ENV],
      useFactory: (env: Env) =>
        new LLMClientFactory({
          openAiApiKey: env.OPENAI_API_KEY,
          googleApiKey: env.GEMINI_API_KEY ?? env.GOOGLE_API_KEY,
          azureOpenAi: {
            apiKey: env.AZURE_OPENAI_API_KEY,
            endpoint: env.AZURE_OPENAI_ENDPOINT,
            apiVersion: env.AZURE_OPENAI_API_VERSION,
            deployments: {
              gpt41Mini: env.AZURE_OPENAI_DEPLOYMENT_GPT_4_1_MINI,
              gpt41: env.AZURE_OPENAI_DEPLOYMENT_GPT_4_1,
              gpt5: env.AZURE_OPENAI_DEPLOYMENT_GPT_5,
            },
          },
        }),
    },
  ],
  exports: [LLM_CLIENT_FACTORY],
})
export class LlmModule {}
