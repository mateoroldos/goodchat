import type { Database } from "@goodchat/contracts/database/interface";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { describe, expect, it, vi } from "vitest";
import {
  createCoreDbCapability,
  createPluginHookCapabilities,
} from "./hook-capabilities";

const SCHEMA = [
  {
    columns: [{ columnName: "bucket", dataType: "text" as const }],
    tableName: "limits",
  },
] as const;

const makeDb = () => {
  const table = { bucket: Symbol("bucket") };
  const findFirst = vi.fn(async () => ({ bucket: "x" }));
  const findMany = vi.fn(async () => [{ bucket: "x" }]);
  // select is the only connection method asserted on; the rest are plain stubs
  const select = vi.fn(() => ({
    from: () => ({ limit: async () => [] as unknown[] }),
  }));

  const db = {
    aiRunToolCalls: {} as never,
    aiRuns: {} as never,
    analytics: {} as never,
    connection: {
      delete: () => ({}),
      insert: () => ({}),
      select,
      update: () => ({}),
    },
    dialect: "sqlite",
    messages: {} as never,
    schema: { rate_limiter_limits: table },
    threads: {} as never,
    transaction: () => Promise.resolve(),
  } as unknown as Database;

  (db.connection as { query?: unknown }).query = {
    limits: { findFirst, findMany },
  };

  return { db, findFirst, findMany, select };
};

describe("hook capabilities", () => {
  it("Core db capability exposes the five core repositories", () => {
    const { db: database } = makeDb();
    const db = createCoreDbCapability(database);

    expect(db.threads).toBe(database.threads);
    expect(db.messages).toBe(database.messages);
    expect(db.aiRuns).toBe(database.aiRuns);
    expect(db.aiRunToolCalls).toBe(database.aiRunToolCalls);
    expect(db.analytics).toBe(database.analytics);
  });

  it("Plugin hook exposes core db capability on db.core", () => {
    const { db: database } = makeDb();
    const db = createPluginHookCapabilities({
      database,
      pluginName: "rate-limiter",
      schema: SCHEMA,
    });

    expect(db.core.threads).toBe(database.threads);
    expect(db.core.messages).toBe(database.messages);
    expect(db.core.aiRuns).toBe(database.aiRuns);
    expect(db.core.aiRunToolCalls).toBe(database.aiRunToolCalls);
    expect(db.core.analytics).toBe(database.analytics);
  });

  it("Plugin hook delegates select() through to the underlying connection", async () => {
    const { db: database, select } = makeDb();
    const db = createPluginHookCapabilities({
      database,
      pluginName: "rate-limiter",
      schema: SCHEMA,
    });

    await db.select().from(db.tables.limits).limit(1);

    expect(select).toHaveBeenCalledTimes(1);
  });

  it("Plugin hook rejects access to tables outside its declared scope", () => {
    const { db: database } = makeDb();
    const db = createPluginHookCapabilities({
      database,
      pluginName: "rate-limiter",
      schema: SCHEMA,
    });

    expect(() => db.select().from({ table: "threads" })).toThrow(
      "outside plugin"
    );
  });

  it("Plugin hook resolves generated Drizzle schema keys from physical plugin table names", async () => {
    const table = sqliteTable("rate_limiter_counters", {
      id: text("id").primaryKey(),
    });
    const { db: baseDatabase, select } = makeDb();
    const database = {
      ...baseDatabase,
      schema: { rateLimiterCounters: table },
    } as Database;

    const db = createPluginHookCapabilities({
      database,
      pluginName: "rate-limiter",
      schema: [
        {
          columns: [{ columnName: "id", dataType: "id" as const }],
          tableName: "counters" as const,
        },
      ],
    });

    await db.query.counters.findFirst();

    expect(db.tables.counters).toBe(table);
    expect(select).toHaveBeenCalled();
  });

  it("Plugin hook provides query.findFirst through scoped select", async () => {
    const { db: database, select } = makeDb();
    const db = createPluginHookCapabilities({
      database,
      pluginName: "rate-limiter",
      schema: SCHEMA,
    });

    await db.query.limits.findFirst();

    expect(select).toHaveBeenCalledTimes(1);
  });

  it("Plugin hook provides query.findMany through scoped select", async () => {
    const { db: database, select } = makeDb();
    const db = createPluginHookCapabilities({
      database,
      pluginName: "rate-limiter",
      schema: SCHEMA,
    });

    await db.query.limits.findMany();

    expect(select).toHaveBeenCalledTimes(1);
  });
});
