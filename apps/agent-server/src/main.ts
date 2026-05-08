import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ENV } from "./config/config.module";
import type { Env } from "./config/env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const env = app.get<Env>(ENV);
  const logger = new Logger("AgentMesh");

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  logger.log(`agent-server listening on http://localhost:${port}`);
  logger.debug(`Solana RPC configured: ${env.SOLANA_RPC_URL}`);
}

void bootstrap();
