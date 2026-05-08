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
          anthropicApiKey: env.ANTHROPIC_API_KEY,
          openAiApiKey: env.OPENAI_API_KEY,
          googleApiKey: env.GOOGLE_API_KEY,
        }),
    },
  ],
  exports: [LLM_CLIENT_FACTORY],
})
export class LlmModule {}
