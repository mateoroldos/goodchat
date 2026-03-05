import { DefaultLocalAdapterService } from "@goodchat/adapters/local-adapter";
import { webhookSchema } from "@goodchat/adapters/local-adapter.schema";
import { DefaultBotService } from "@goodchat/core/bot";
import type { BotConfig } from "@goodchat/core/bot.types";
import type { LogStoreService } from "@goodchat/core/log-store";
import { matchError } from "better-result";
import { Elysia } from "elysia";
import { createRequestId, logApiError } from "../../utils/errors";
import { handleLocalWebhook } from "./service";

export const webhookLocalController = (
  botConfig: BotConfig,
  logger: LogStoreService
) =>
  new Elysia({ prefix: "/webhook" }).post(
    "/local",
    ({ body, set }) => {
      const services = {
        adapter: new DefaultLocalAdapterService(),
        bot: new DefaultBotService(),
        logger,
      };

      const result = handleLocalWebhook(body, botConfig, services);

      if (result.isErr()) {
        const error = result.error;
        const requestId = createRequestId();
        logApiError(requestId, error);

        return matchError(error, {
          InvalidPayloadError: (taggedError) => {
            set.status = 400;
            return {
              code: taggedError.code,
              message: "Invalid request payload.",
              requestId,
            };
          },
          BotInputInvalidError: (taggedError) => {
            set.status = 400;
            return {
              code: taggedError.code,
              message: "Invalid bot message input.",
              requestId,
            };
          },
        });
      }

      return result.value;
    },
    {
      body: webhookSchema,
    }
  );
