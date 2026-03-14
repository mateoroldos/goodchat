import type { MessageStoreService } from "@goodchat/core/message-store/message-store.service.interface";
import { Elysia } from "elysia";
import type { BotRegistry } from "../../runtime/bot-registry";
import { createRequestId, logApiError } from "../../utils/errors";
import { botParamsModel, botThreadsQueryModel } from "./model";

export const botsController = (
  registry: BotRegistry,
  messageStore: MessageStoreService
) =>
  new Elysia({ prefix: "/bots" })
    .get("/", () =>
      registry.listBots().map((bot) => ({
        id: bot.id,
        name: bot.name,
        prompt: bot.prompt,
        platforms: bot.platforms,
      }))
    )
    .get(
      "/:id",
      ({ params, status }) => {
        const bot = registry.getConfig(params.id);

        if (!bot) {
          return status(404, { message: "Bot not found" });
        }

        return {
          id: bot.id,
          name: bot.name,
          prompt: bot.prompt,
          platforms: bot.platforms,
        };
      },
      {
        params: botParamsModel,
      }
    )
    .get(
      "/:id/threads",
      ({ params, query, status }) => {
        const limit = query.limit;
        const result = messageStore.listThreads(200);
        if (result.isErr()) {
          const error = result.error;
          const requestId = createRequestId();

          logApiError(requestId, error);

          switch (error.code) {
            case "THREAD_LIMIT_INVALID":
              return status(422, {
                code: error.code,
                message: "Thread limit must be a non-negative number.",
                requestId,
              });
            default:
              return status(500, {
                code: "THREADS_UNKNOWN",
                message: "Unexpected error while loading threads.",
                requestId,
              });
          }
        }

        return result.value
          .filter((entry) => entry.botId === params.id)
          .slice(0, limit);
      },
      {
        params: botParamsModel,
        query: botThreadsQueryModel,
      }
    );
