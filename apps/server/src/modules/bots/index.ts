import type { MessageStoreService } from "@goodchat/core/message-store/message-store.service.interface";
import { Elysia, t } from "elysia";
import type { BotRegistry } from "../../runtime/bot-registry";

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
    .get("/:id", ({ params, set }) => {
      const bot = registry.getConfig(params.id);
      if (!bot) {
        set.status = 404;
        return { message: "Bot not found" };
      }
      return {
        id: bot.id,
        name: bot.name,
        prompt: bot.prompt,
        platforms: bot.platforms,
      };
    })
    .get(
      "/:id/threads",
      ({ params, query }) => {
        const limit = query.limit ?? 50;
        const result = messageStore.listThreads(200);
        if (result.isErr()) {
          return [];
        }
        return result.value
          .filter((entry) => entry.botId === params.id)
          .slice(0, limit);
      },
      {
        query: t.Object({
          limit: t.Optional(t.Numeric({ minimum: 0, maximum: 200 })),
        }),
      }
    );
