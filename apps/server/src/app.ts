import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { FileConfigService } from "@goodchat/core/config";
import { InMemoryLogStoreService } from "@goodchat/core/log-store";
import { Elysia } from "elysia";
import { env } from "./env";
import { logsController } from "./modules/logs";
import { webhookLocalController } from "./modules/webhook-local";

const configService = new FileConfigService();
const botResult = await configService.loadBotConfig();
if (botResult.isErr()) {
  console.error("Failed to load bot config:", botResult.error.message);
  process.exit(1);
}

const botConfig = botResult.value;

const logger = new InMemoryLogStoreService();

export const app = new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
    })
  )
  .use(openapi())
  .get("/", () => "OK")
  .use(webhookLocalController(botConfig, logger))
  .use(logsController(logger));

export type App = typeof app;
