import { createMemoryState } from "@chat-adapter/state-memory";
import { createPostgresState } from "@chat-adapter/state-pg";
import { createRedisState } from "@chat-adapter/state-redis";
import { createMysqlState } from "@goodchat/state-mysql";
import { createSqliteState } from "@goodchat/state-sqlite";
import type { StateAdapter } from "chat";
import type { ChatGatewayConfig } from "./interface";

interface PgPoolLike {
  end: (...args: unknown[]) => unknown;
  query: (...args: unknown[]) => unknown;
}

interface MysqlPoolLike {
  end: (...args: unknown[]) => unknown;
  execute: (...args: unknown[]) => unknown;
  getConnection: (...args: unknown[]) => unknown;
}

interface BunSqliteDatabaseLike {
  close: (...args: unknown[]) => unknown;
  prepare: (...args: unknown[]) => unknown;
  run: (...args: unknown[]) => unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasMethod = (value: unknown, methodName: string): boolean =>
  isObject(value) && typeof value[methodName] === "function";

const isPgPoolLike = (value: unknown): value is PgPoolLike =>
  hasMethod(value, "query") && hasMethod(value, "end");

const isMysqlPoolLike = (value: unknown): value is MysqlPoolLike =>
  hasMethod(value, "execute") &&
  hasMethod(value, "getConnection") &&
  hasMethod(value, "end");

const isBunSqliteDatabaseLike = (
  value: unknown
): value is BunSqliteDatabaseLike =>
  hasMethod(value, "prepare") &&
  hasMethod(value, "run") &&
  hasMethod(value, "close");

export const createStateAdapter = (config: ChatGatewayConfig): StateAdapter => {
  if (config.state.adapter === "memory") {
    config.logger.event.info(
      "[gateway] State adapter explicitly configured to memory."
    );
    return createMemoryState();
  }

  if (config.state.adapter === "redis") {
    try {
      if (config.state.redisUrl) {
        config.logger.event.info(
          "[gateway] State adapter configured to redis with explicit redisUrl."
        );
        return createRedisState({ url: config.state.redisUrl });
      }

      config.logger.event.info(
        "[gateway] State adapter configured to redis using environment variables."
      );
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

const createPostgresDatabaseStateAdapter = (
  config: ChatGatewayConfig,
  rawConnection: unknown,
  connectionFlavor: string | undefined
): StateAdapter => {
  if (connectionFlavor === "pg") {
    if (isPgPoolLike(rawConnection)) {
      config.logger.event.info(
        "[gateway] Using existing pg.Pool from database for Postgres state adapter."
      );
      return createPostgresState({ client: rawConnection as never });
    }

    config.logger.event.warn(
      "[gateway] Postgres database flavor is pg, but rawConnection is unavailable or incompatible. Falling back to URL/env-based Postgres state adapter."
    );
    return createPostgresState();
  }

  if (rawConnection === undefined) {
    config.logger.event.info(
      "[gateway] Postgres database does not expose a reusable raw connection. Using URL/env-based Postgres state adapter."
    );
    return createPostgresState();
  }

  config.logger.event.info(
    `[gateway] Postgres database flavor "${connectionFlavor ?? "unknown"}" is not pg. Existing connection cannot be reused by state-pg; using URL/env-based Postgres state adapter.`
  );
  return createPostgresState();
};

const createMysqlDatabaseStateAdapter = (
  config: ChatGatewayConfig,
  rawConnection: unknown,
  connectionFlavor: string | undefined
): StateAdapter => {
  if (isMysqlPoolLike(rawConnection)) {
    if (connectionFlavor === "mysql2-planetscale") {
      config.logger.event.warn(
        "[gateway] Reusing mysql2 Planetscale connection for state adapter. Verify transaction and lock semantics in your Planetscale deployment."
      );
    } else {
      config.logger.event.info(
        "[gateway] Using existing mysql2 pool from database for MySQL state adapter."
      );
    }

    return createMysqlState({ client: rawConnection as never });
  }

  if (rawConnection === undefined) {
    config.logger.event.info(
      "[gateway] MySQL database does not expose a reusable raw connection. Using URL/env-based MySQL state adapter."
    );
    return createMysqlState();
  }

  config.logger.event.warn(
    "[gateway] MySQL rawConnection is present but incompatible with mysql2 pool requirements. Falling back to URL/env-based MySQL state adapter."
  );
  return createMysqlState();
};

const createSqliteDatabaseStateAdapter = (
  config: ChatGatewayConfig,
  rawConnection: unknown
): StateAdapter => {
  if (isBunSqliteDatabaseLike(rawConnection)) {
    config.logger.event.info(
      "[gateway] Using existing Bun SQLite connection from database for SQLite state adapter."
    );
    return createSqliteState({ client: rawConnection as never });
  }

  if (rawConnection === undefined) {
    config.logger.event.info(
      "[gateway] SQLite database does not expose a reusable raw connection. Falling back to path/env-based SQLite state adapter."
    );
  } else {
    config.logger.event.warn(
      "[gateway] SQLite rawConnection is present but incompatible with Bun SQLite Database requirements. Falling back to path/env-based SQLite state adapter."
    );
  }

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
};

export const createDatabaseStateAdapter = (
  config: ChatGatewayConfig
): StateAdapter => {
  const { database } = config;
  const { connectionFlavor, rawConnection } = database;

  try {
    config.logger.event.info(
      `[gateway] Resolving database-backed state adapter (dialect=${database.dialect}, flavor=${connectionFlavor ?? "unknown"}, hasRawConnection=${rawConnection === undefined ? "no" : "yes"}).`
    );

    if (database.dialect === "postgres") {
      return createPostgresDatabaseStateAdapter(
        config,
        rawConnection,
        connectionFlavor
      );
    }

    if (database.dialect === "mysql") {
      return createMysqlDatabaseStateAdapter(
        config,
        rawConnection,
        connectionFlavor
      );
    }

    if (database.dialect === "sqlite") {
      return createSqliteDatabaseStateAdapter(config, rawConnection);
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
