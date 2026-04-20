import { createDiscordAdapter } from "@chat-adapter/discord";
import { createGoogleChatAdapter } from "@chat-adapter/gchat";
import { createGitHubAdapter } from "@chat-adapter/github";
import { createLinearAdapter } from "@chat-adapter/linear";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { CHAT_PLATFORMS } from "@goodchat/contracts/config/models";
import type { Platform } from "@goodchat/contracts/config/types";
import { PLATFORM_REQUIRED_ENV_KEYS } from "@goodchat/contracts/platform/platform-metadata";
import type { Adapter } from "chat";
import { Chat } from "chat";
import type { LoggerService } from "../logger/interface";
import {
  ChatAdapterInitializationError,
  ChatGatewayInitializationError,
} from "./errors";
import type {
  ChatGatewayConfig,
  ChatGatewayHandlers,
  ChatGatewayService,
} from "./interface";

const CHAT_PLATFORM_SET = new Set<string>(CHAT_PLATFORMS);

const isChatPlatform = (platform: Platform): platform is Platform =>
  CHAT_PLATFORM_SET.has(platform);

const createStateAdapter = () =>
  process.env.REDIS_URL ? createRedisState() : createMemoryState();

const ADAPTER_FACTORIES: Partial<Record<Platform, () => Adapter>> = {
  discord: () => createDiscordAdapter() as unknown as Adapter,
  gchat: () => createGoogleChatAdapter() as unknown as Adapter,
  github: () => createGitHubAdapter() as unknown as Adapter,
  linear: () => createLinearAdapter() as unknown as Adapter,
  slack: () => createSlackAdapter() as unknown as Adapter,
  teams: () => createTeamsAdapter() as unknown as Adapter,
};

const createAdapters = (
  platforms: readonly Platform[],
  logger: LoggerService
) => {
  const adapters: Record<string, Adapter> = {};
  const errors: ChatAdapterInitializationError[] = [];
  const active: Platform[] = [];

  for (const platform of platforms) {
    const factory = ADAPTER_FACTORIES[platform];
    if (!factory) {
      continue;
    }

    const required = PLATFORM_REQUIRED_ENV_KEYS[platform] ?? [];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      logger.event.warn(
        `[gateway] Skipping ${platform} — missing env vars: ${missing.join(", ")}`
      );
      continue;
    }

    try {
      adapters[platform] = factory();
      active.push(platform);
    } catch (error) {
      errors.push(
        new ChatAdapterInitializationError(
          `Failed to initialize ${platform} adapter`,
          platform,
          error
        )
      );
    }
  }

  return { adapters, active, errors };
};

export class DefaultChatGatewayService implements ChatGatewayService {
  readonly #chat: Chat;
  readonly #platformIds: readonly Platform[];

  constructor(config: ChatGatewayConfig) {
    const enabledPlatforms = config.platforms.filter(isChatPlatform);

    const { adapters, active, errors } = createAdapters(
      enabledPlatforms,
      config.logger
    );
    this.#platformIds = active;
    if (errors.length > 0) {
      throw new ChatGatewayInitializationError(
        "Failed to initialize chat adapters",
        errors
      );
    }

    this.#chat = new Chat({
      userName: config.userName,
      adapters,
      state: createStateAdapter(),
    });
  }

  getPlatformIds() {
    return this.#platformIds;
  }

  getAdapter(name: Platform) {
    return this.#chat.getAdapter(name) ?? null;
  }

  getWebhooks() {
    return this.#chat.webhooks;
  }

  async initialize() {
    await this.#chat.initialize();
  }

  async shutdown() {
    const disposable = this.#chat as {
      dispose?: () => Promise<void> | void;
    };

    if (typeof disposable.dispose === "function") {
      await disposable.dispose();
    }
  }

  registerHandlers(handlers: ChatGatewayHandlers) {
    if (handlers.onNewMention) {
      this.#chat.onNewMention(handlers.onNewMention);
    }

    if (handlers.onSubscribedMessage) {
      this.#chat.onSubscribedMessage(handlers.onSubscribedMessage);
    }
  }
}
