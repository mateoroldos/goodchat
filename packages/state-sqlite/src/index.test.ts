import type { Lock, Logger } from "chat";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Database,
  getSqliteMockState,
  resetSqliteMock,
  setSqliteMockHandler,
} from "./test-bun-sqlite";

const RE_INSERT_OR_IGNORE = /INSERT OR IGNORE/i;
const RE_SUBSCRIPTIONS_TABLE = /chat_state_subscriptions/;
const RE_DELETE_SUBSCRIPTIONS = /DELETE FROM chat_state_subscriptions/i;
const RE_SQLITE_TOKEN = /^sqlite_/;
const RE_DELETE_LOCKS = /DELETE FROM chat_state_locks/i;
const RE_REPLACE_CACHE = /INSERT OR REPLACE INTO chat_state_cache/i;
const RE_DELETE_CACHE = /DELETE FROM chat_state_cache/i;
const RE_BEGIN_IMMEDIATE = /BEGIN IMMEDIATE/i;
const RE_COMMIT = /COMMIT/i;

const { createSqliteState, SqliteStateAdapter } = await import("./index");

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

function connectedAdapter(): InstanceType<typeof SqliteStateAdapter> {
  const adapter = new SqliteStateAdapter({
    client: new Database() as never,
    logger: mockLogger,
  });
  (adapter as unknown as { connected: boolean }).connected = true;
  return adapter;
}

describe("SqliteStateAdapter", () => {
  beforeEach(() => {
    resetSqliteMock();
  });

  afterEach(() => {
    resetSqliteMock();
  });

  it("should export createSqliteState function", () => {
    expect(typeof createSqliteState).toBe("function");
  });

  it("should export SqliteStateAdapter class", () => {
    expect(typeof SqliteStateAdapter).toBe("function");
  });

  describe("createSqliteState", () => {
    it("should create an adapter with defaults", () => {
      const adapter = createSqliteState({ logger: mockLogger });
      expect(adapter).toBeInstanceOf(SqliteStateAdapter);
    });

    it("should create an adapter with path option", () => {
      const adapter = createSqliteState({
        path: ":memory:",
        logger: mockLogger,
      });
      expect(adapter).toBeInstanceOf(SqliteStateAdapter);
    });

    it("should create an adapter with custom keyPrefix", () => {
      const adapter = createSqliteState({
        keyPrefix: "custom",
        logger: mockLogger,
      });
      expect(adapter).toBeInstanceOf(SqliteStateAdapter);
    });

    it("should create an adapter with an existing client", () => {
      const adapter = createSqliteState({
        client: new Database() as never,
        logger: mockLogger,
      });
      expect(adapter).toBeInstanceOf(SqliteStateAdapter);
    });
  });

  describe("connect / disconnect", () => {
    beforeEach(() => {
      vi.stubGlobal("Bun", {});
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("connect() runs SELECT 1 then schema bootstrap", async () => {
      const adapter = createSqliteState({ logger: mockLogger });
      await adapter.connect();
      const calls = getSqliteMockState().runCalls.map((call) =>
        call.sql.trim()
      );
      expect(calls[0]).toBe("SELECT 1");
      expect(
        calls.some((sql) => sql.includes("chat_state_subscriptions"))
      ).toBe(true);
    });

    it("connect() is idempotent", async () => {
      const adapter = createSqliteState({ logger: mockLogger });
      await adapter.connect();
      const firstCount = getSqliteMockState().runCalls.length;
      await adapter.connect();
      expect(getSqliteMockState().runCalls.length).toBe(firstCount);
    });

    it("disconnect() closes client when connected", async () => {
      const adapter = createSqliteState({ logger: mockLogger });
      await adapter.connect();
      await adapter.disconnect();
      expect(getSqliteMockState().closeCalls).toBe(1);
    });

    it("disconnect() does not close db when client is external", async () => {
      const db = new Database() as never;
      const adapter = new SqliteStateAdapter({
        client: db,
        logger: mockLogger,
      });
      (adapter as unknown as { connected: boolean }).connected = true;
      await adapter.disconnect();
      expect(getSqliteMockState().closeCalls).toBe(0);
    });

    it("throws when connect() fails", async () => {
      setSqliteMockHandler((sql, method) => {
        if (method === "run" && sql.trim() === "SELECT 1") {
          throw new Error("connection refused");
        }
        return null;
      });
      const adapter = createSqliteState({ logger: mockLogger });
      await expect(adapter.connect()).rejects.toThrow("connection refused");
    });

    it("throws when methods called before connect()", async () => {
      const adapter = createSqliteState({ logger: mockLogger });
      await expect(adapter.isSubscribed("t1")).rejects.toThrow("not connected");
    });
  });

  describe("subscriptions", () => {
    it("subscribe() runs INSERT OR IGNORE", async () => {
      const adapter = connectedAdapter();
      await adapter.subscribe("thread-1");
      const sql = getSqliteMockState().runCalls[0]?.sql ?? "";
      expect(sql).toMatch(RE_INSERT_OR_IGNORE);
      expect(sql).toMatch(RE_SUBSCRIPTIONS_TABLE);
    });

    it("unsubscribe() runs DELETE", async () => {
      const adapter = connectedAdapter();
      await adapter.unsubscribe("thread-1");
      const sql = getSqliteMockState().runCalls[0]?.sql ?? "";
      expect(sql).toMatch(RE_DELETE_SUBSCRIPTIONS);
    });

    it("isSubscribed() returns true when row exists", async () => {
      setSqliteMockHandler((sql, method) => {
        if (method === "get" && sql.includes("chat_state_subscriptions")) {
          return { ok: 1 };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const result = await adapter.isSubscribed("thread-1");
      expect(result).toBe(true);
    });

    it("isSubscribed() returns false when no row", async () => {
      const adapter = connectedAdapter();
      const result = await adapter.isSubscribed("thread-1");
      expect(result).toBe(false);
    });
  });

  describe("locks", () => {
    it("acquireLock() returns Lock when token matches", async () => {
      let token = "";
      setSqliteMockHandler((sql, method, params) => {
        if (method === "run" && sql.startsWith("UPDATE chat_state_locks")) {
          token = String(params[0] ?? "");
          return { changes: 1 };
        }
        if (
          method === "get" &&
          sql.includes("SELECT thread_id, token, expires_at")
        ) {
          return { thread_id: "t1", token, expires_at: Date.now() + 5000 };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const lock = await adapter.acquireLock("t1", 5000);
      expect(lock).not.toBeNull();
      expect(lock?.threadId).toBe("t1");
      expect(lock?.token).toMatch(RE_SQLITE_TOKEN);
      const runSql = getSqliteMockState().runCalls.map((call) => call.sql);
      expect(runSql.some((sql) => RE_BEGIN_IMMEDIATE.test(sql))).toBe(true);
    });

    it("acquireLock() returns null when lock is held", async () => {
      setSqliteMockHandler((sql, method) => {
        if (
          method === "get" &&
          sql.includes("SELECT thread_id, token, expires_at")
        ) {
          return {
            thread_id: "t1",
            token: "sqlite_other",
            expires_at: Date.now() + 5000,
          };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const lock = await adapter.acquireLock("t1", 5000);
      expect(lock).toBeNull();
    });

    it("releaseLock() deletes by token", async () => {
      const adapter = connectedAdapter();
      const lock: Lock = {
        threadId: "t1",
        token: "sqlite_tok",
        expiresAt: Date.now() + 1000,
      };
      await adapter.releaseLock(lock);
      const call = getSqliteMockState().runCalls[0];
      expect(call?.sql ?? "").toMatch(RE_DELETE_LOCKS);
      expect(call?.params).toContain("sqlite_tok");
    });

    it("forceReleaseLock() deletes without token check", async () => {
      const adapter = connectedAdapter();
      await adapter.forceReleaseLock("t1");
      const call = getSqliteMockState().runCalls[0];
      expect(call?.sql ?? "").toMatch(RE_DELETE_LOCKS);
      expect(call?.params.length).toBe(2);
    });

    it("extendLock() returns true when row updated", async () => {
      setSqliteMockHandler((sql, method) => {
        if (method === "run" && sql.startsWith("UPDATE chat_state_locks")) {
          return { changes: 1 };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const lock: Lock = {
        threadId: "t1",
        token: "sqlite_tok",
        expiresAt: Date.now() + 1000,
      };
      const ok = await adapter.extendLock(lock, 5000);
      expect(ok).toBe(true);
    });

    it("extendLock() returns false when lock expired or token mismatch", async () => {
      const adapter = connectedAdapter();
      const lock: Lock = {
        threadId: "t1",
        token: "sqlite_tok",
        expiresAt: Date.now() - 1000,
      };
      const ok = await adapter.extendLock(lock, 5000);
      expect(ok).toBe(false);
    });
  });

  describe("cache", () => {
    it("get() returns parsed JSON value", async () => {
      setSqliteMockHandler((sql, method) => {
        if (
          method === "get" &&
          sql.includes("SELECT value FROM chat_state_cache")
        ) {
          return { value: '{"x":1}' };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const value = await adapter.get<{ x: number }>("key1");
      expect(value).toEqual({ x: 1 });
    });

    it("get() returns null and cleans up when no row", async () => {
      const adapter = connectedAdapter();
      const value = await adapter.get("key1");
      expect(value).toBeNull();
      const calls = getSqliteMockState().runCalls;
      expect(calls.some((call) => call.sql.includes("DELETE"))).toBe(true);
    });

    it("set() upserts with INSERT OR REPLACE", async () => {
      const adapter = connectedAdapter();
      await adapter.set("key1", { foo: "bar" });
      const sql = getSqliteMockState().runCalls[0]?.sql ?? "";
      expect(sql).toMatch(RE_REPLACE_CACHE);
    });

    it("setIfNotExists() returns true when row inserted", async () => {
      setSqliteMockHandler((sql, method) => {
        if (method === "get" && sql.includes("SELECT changes() AS n")) {
          return { n: 1 };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const ok = await adapter.setIfNotExists("key1", "val");
      expect(ok).toBe(true);
    });

    it("setIfNotExists() returns false when key already exists", async () => {
      setSqliteMockHandler((sql, method) => {
        if (method === "get" && sql.includes("SELECT changes() AS n")) {
          return { n: 0 };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const ok = await adapter.setIfNotExists("key1", "val");
      expect(ok).toBe(false);
    });

    it("delete() removes the entry", async () => {
      const adapter = connectedAdapter();
      await adapter.delete("key1");
      const sql = getSqliteMockState().runCalls[0]?.sql ?? "";
      expect(sql).toMatch(RE_DELETE_CACHE);
    });
  });

  describe("lists", () => {
    it("appendToList() inserts then trims when maxLength set", async () => {
      const adapter = connectedAdapter();
      await adapter.appendToList("list1", "item", { maxLength: 5 });
      const calls = getSqliteMockState().runCalls;
      expect(
        calls.some((call) => call.sql.includes("INSERT INTO chat_state_lists"))
      ).toBe(true);
      expect(calls.some((call) => call.sql.includes("NOT IN"))).toBe(true);
    });

    it("appendToList() refreshes TTL on all entries when ttlMs given", async () => {
      const adapter = connectedAdapter();
      await adapter.appendToList("list1", "item", { ttlMs: 1000 });
      const calls = getSqliteMockState().runCalls;
      expect(
        calls.some((call) => call.sql.includes("UPDATE chat_state_lists"))
      ).toBe(true);
    });

    it("getList() returns values in insertion order", async () => {
      setSqliteMockHandler((sql, method) => {
        if (method === "all" && sql.includes("FROM chat_state_lists")) {
          return [{ value: '"a"' }, { value: '"b"' }];
        }
        return [];
      });
      const adapter = connectedAdapter();
      const list = await adapter.getList<string>("list1");
      expect(list).toEqual(["a", "b"]);
    });
  });

  describe("queue", () => {
    it("queueDepth() returns count of non-expired entries", async () => {
      setSqliteMockHandler((sql, method) => {
        if (method === "get" && sql.includes("COUNT(*) AS depth")) {
          return { depth: 3 };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const depth = await adapter.queueDepth("t1");
      expect(depth).toBe(3);
    });

    it("dequeue() uses a BEGIN IMMEDIATE transaction", async () => {
      setSqliteMockHandler((sql, method) => {
        if (
          method === "get" &&
          sql.includes("SELECT id, value FROM chat_state_queues")
        ) {
          return { id: 1, value: '{"expiresAt":9999999999999,"enqueuedAt":1}' };
        }
        return null;
      });
      const adapter = connectedAdapter();
      const entry = await adapter.dequeue("t1");
      expect(entry).not.toBeNull();
      const runSql = getSqliteMockState().runCalls.map((call) => call.sql);
      expect(runSql.some((sql) => RE_BEGIN_IMMEDIATE.test(sql))).toBe(true);
      expect(runSql.some((sql) => RE_COMMIT.test(sql))).toBe(true);
    });

    it("dequeue() returns null when queue is empty", async () => {
      const adapter = connectedAdapter();
      const entry = await adapter.dequeue("t1");
      expect(entry).toBeNull();
    });
  });

  describe("getClient()", () => {
    it("returns the underlying database", () => {
      const adapter = connectedAdapter();
      expect(adapter.getClient()).toBeDefined();
    });
  });
});
