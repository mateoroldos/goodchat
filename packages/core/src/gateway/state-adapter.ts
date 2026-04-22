import { createMemoryState } from "@chat-adapter/state-memory";
import { createPostgresState } from "@chat-adapter/state-pg";
import { createRedisState } from "@chat-adapter/state-redis";
import { createMysqlState } from "@goodchat/state-mysql";
import { createSqliteState } from "@goodchat/state-sqlite";
import type { StateAdapter } from "chat";
import type { ChatGatewayConfig } from "./interface";

export const createStateAdapter = (config: ChatGatewayConfig): StateAdapter => {
  if (config.state.adapter === "memory") {
    return createMemoryState();
  }

  if (config.state.adapter === "redis") {
    try {
      if (config.state.redisUrl) {
        return createRedisState({ url: config.state.redisUrl });
      }

      return createRedisState();
    } catch (error) {
      config.logger.event.warn(
        "[gateway] Redis state adapter could not be initialized. Falling back to memory state.",
        { error }
      );
      return createMemoryState();
    }
  }

  return createDatabaseStateAdapter(config);
};

export const createDatabaseStateAdapter = (
  config: ChatGatewayConfig
): StateAdapter => {
  const { database } = config;

  try {
    if (database.dialect === "postgres") {
      return createPostgresState();
    }

    if (database.dialect === "mysql") {
      return createMysqlState();
    }

    if (database.dialect === "sqlite") {
      const path = process.env.SQLITE_URL ?? process.env.DATABASE_URL;
      if (!path) {
        config.logger.event.warn(
          "[gateway] SQLite state adapter requires SQLITE_URL or DATABASE_URL. Falling back to memory state."
        );
        return createMemoryState();
      }

      if (typeof globalThis.Bun === "undefined") {
        config.logger.event.warn(
          "[gateway] SQLite state adapter requires Bun runtime. Falling back to memory state."
        );
        return createMemoryState();
      }

      return createSqliteState({ path });
    }

    config.logger.event.warn(
      `[gateway] Unsupported database dialect "${database.dialect}" for state adapter. Falling back to memory state.`
    );
    return createMemoryState();
  } catch (error) {
    config.logger.event.warn(
      `[gateway] Failed to initialize ${database.dialect} state adapter. Falling back to memory state.`,
      error
    );
    return createMemoryState();
  }
};
