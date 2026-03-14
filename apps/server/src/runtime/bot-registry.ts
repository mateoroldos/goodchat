import type { BotConfig, Platform } from "@goodchat/core/config/models";
import type { MessageStoreService } from "@goodchat/core/message-store/message-store.service.interface";
import { Result } from "better-result";
import type { ChatRuntime } from "./create-chat-runtime";
import { createChatRuntime } from "./create-chat-runtime";
import type { ChatRuntimeInitializationError } from "./errors";
import { BotNotFoundError } from "./errors";

interface BotRecord {
  config: BotConfig;
  runtime?: ChatRuntime;
}

const arePlatformsEqual = (a: readonly Platform[], b: readonly Platform[]) => {
  if (a.length !== b.length) {
    return false;
  }

  const platformSet = new Set(b);
  for (const platform of a) {
    if (!platformSet.has(platform)) {
      return false;
    }
  }

  return true;
};

const requiresReinit = (prev: BotConfig, next: BotConfig) =>
  prev.name !== next.name || !arePlatformsEqual(prev.platforms, next.platforms);

export class BotRegistry {
  readonly #bots = new Map<string, BotRecord>();
  readonly #messageStore: MessageStoreService;
  constructor(messageStore: MessageStoreService) {
    this.#messageStore = messageStore;
  }

  listBots() {
    return Array.from(this.#bots.values()).map((record) => record.config);
  }

  getConfig(botId: string) {
    return this.#bots.get(botId)?.config ?? null;
  }

  getRuntime(
    botId: string
  ): Result<ChatRuntime, BotNotFoundError | ChatRuntimeInitializationError> {
    const record = this.#bots.get(botId);
    if (!record) {
      return Result.err(new BotNotFoundError("Bot not found"));
    }

    if (record.runtime) {
      return Result.ok(record.runtime);
    }

    const runtimeResult = createChatRuntime(record.config, this.#messageStore);
    if (runtimeResult.isErr()) {
      return runtimeResult;
    }

    record.runtime = runtimeResult.value;
    return Result.ok(runtimeResult.value);
  }

  async applyConfigs(configs: BotConfig[]) {
    const nextIds = new Set(configs.map((bot) => bot.id));

    for (const [botId, record] of this.#bots) {
      if (!nextIds.has(botId)) {
        if (record.runtime?.gateway) {
          await record.runtime.gateway.shutdown();
        }
        this.#bots.delete(botId);
      }
    }

    for (const config of configs) {
      const existing = this.#bots.get(config.id);
      if (!existing) {
        this.#bots.set(config.id, { config });
        continue;
      }

      if (requiresReinit(existing.config, config)) {
        if (existing.runtime?.gateway) {
          await existing.runtime.gateway.shutdown();
        }
        existing.runtime = undefined;
      }

      existing.config = config;
    }
  }

  async shutdownAll() {
    for (const record of this.#bots.values()) {
      if (record.runtime?.gateway) {
        await record.runtime.gateway.shutdown();
        record.runtime = undefined;
      }
    }
  }
}
