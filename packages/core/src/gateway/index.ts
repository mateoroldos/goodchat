import { createDiscordAdapter } from "@chat-adapter/discord";
import { createGoogleChatAdapter } from "@chat-adapter/gchat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { CHAT_PLATFORMS } from "@goodchat/contracts/config/models";
import type { Platform } from "@goodchat/contracts/config/types";
import type { Adapter } from "chat";
import { Chat } from "chat";
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
  slack: () => createSlackAdapter() as unknown as Adapter,
  teams: () => createTeamsAdapter() as unknown as Adapter,
};

const createAdapters = (platforms: readonly Platform[]) => {
  const adapters: Record<string, Adapter> = {};
  const errors: ChatAdapterInitializationError[] = [];

  for (const platform of platforms) {
    const factory = ADAPTER_FACTORIES[platform];
    if (!factory) {
      continue;
    }

    try {
      adapters[platform] = factory();
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

  return { adapters, errors };
};

export class DefaultChatGatewayService implements ChatGatewayService {
  readonly #chat: Chat;
  readonly #platformIds: readonly Platform[];

  constructor(config: ChatGatewayConfig) {
    const enabledPlatforms = config.platforms.filter(isChatPlatform);
    this.#platformIds = enabledPlatforms;

    const { adapters, errors } = createAdapters(enabledPlatforms);
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
