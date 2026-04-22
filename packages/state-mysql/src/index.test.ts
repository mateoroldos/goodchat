import type { Lock, Logger } from "chat";
import type mysql from "mysql2/promise";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Shared mocks used by the url-based adapter tests (createPool path)
const mockExecute = vi.fn().mockResolvedValue([{ affectedRows: 0 }, []]);
const mockEnd = vi.fn().mockResolvedValue(undefined);
const mockGetConnection = vi.fn();

// Top-level regex constants (lint: useTopLevelRegex)
const RE_INSERT_IGNORE = /INSERT IGNORE/i;
const RE_SUBSCRIPTIONS_TABLE = /chat_state_subscriptions/;
const RE_DELETE_SUBSCRIPTIONS = /DELETE FROM chat_state_subscriptions/i;
const RE_MYSQL_TOKEN = /^mysql_/;
const RE_DELETE_LOCKS = /DELETE FROM chat_state_locks/i;
const RE_UPSERT_CACHE = /ON DUPLICATE KEY UPDATE/i;
const RE_DELETE_CACHE = /DELETE FROM chat_state_cache/i;
const RE_FOR_UPDATE = /FOR UPDATE/i;

vi.mock("mysql2/promise", () => ({
  default: {
    // createPool is a factory — return a plain object, no `new` needed
    createPool: () => ({
      execute: mockExecute,
      end: mockEnd,
      getConnection: mockGetConnection,
    }),
  },
}));

const { createMysqlState, MysqlStateAdapter } = await import("./index");

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

// Build a pool whose execute behaviour can be customised per test.
// Returns [result, fields] tuples matching the mysql2 promise API.
function createMockPool(
  executeFn?: (sql: string, params?: unknown[]) => [unknown, unknown]
): mysql.Pool {
  const defaultFn = (): [unknown, unknown] => [{ affectedRows: 0 }, []];
  const impl = executeFn ?? defaultFn;
  return {
    execute: vi
      .fn()
      .mockImplementation((sql: string, params?: unknown[]) =>
        Promise.resolve(impl(sql, params))
      ),
    end: vi.fn().mockResolvedValue(undefined),
    getConnection: vi.fn(),
  } as unknown as mysql.Pool;
}

// Bypass connect() for unit tests that test methods directly.
function connectedAdapter(
  pool: mysql.Pool
): InstanceType<typeof MysqlStateAdapter> {
  const adapter = new MysqlStateAdapter({ client: pool, logger: mockLogger });
  (adapter as unknown as { connected: boolean }).connected = true;
  return adapter;
}

describe("MysqlStateAdapter", () => {
  it("should export createMysqlState function", () => {
    expect(typeof createMysqlState).toBe("function");
  });

  it("should export MysqlStateAdapter class", () => {
    expect(typeof MysqlStateAdapter).toBe("function");
  });

  describe("createMysqlState", () => {
    it("should create an adapter with url option", () => {
      const adapter = createMysqlState({
        url: "mysql://root:root@localhost:3306/chat",
        logger: mockLogger,
      });
      expect(adapter).toBeInstanceOf(MysqlStateAdapter);
    });

    it("should create an adapter with custom keyPrefix", () => {
      const adapter = createMysqlState({
        url: "mysql://root:root@localhost:3306/chat",
        keyPrefix: "custom",
        logger: mockLogger,
      });
      expect(adapter).toBeInstanceOf(MysqlStateAdapter);
    });

    it("should create an adapter with an existing client", () => {
      const client = createMockPool();
      const adapter = createMysqlState({ client, logger: mockLogger });
      expect(adapter).toBeInstanceOf(MysqlStateAdapter);
    });

    it("should throw when no url or env var is available", () => {
      vi.stubEnv("MYSQL_URL", "");
      vi.stubEnv("DATABASE_URL", "");
      try {
        expect(() => createMysqlState({ logger: mockLogger })).toThrow(
          "MySQL url is required"
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("should use MYSQL_URL env var as fallback", () => {
      vi.stubEnv("MYSQL_URL", "mysql://root:root@localhost:3306/chat");
      try {
        const adapter = createMysqlState({ logger: mockLogger });
        expect(adapter).toBeInstanceOf(MysqlStateAdapter);
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it("should use DATABASE_URL env var as fallback", () => {
      vi.stubEnv("MYSQL_URL", "");
      vi.stubEnv("DATABASE_URL", "mysql://root:root@localhost:3306/chat");
      try {
        const adapter = createMysqlState({ logger: mockLogger });
        expect(adapter).toBeInstanceOf(MysqlStateAdapter);
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  describe("connect / disconnect", () => {
    afterEach(() => {
      mockExecute.mockReset();
      mockEnd.mockReset();
      mockExecute.mockResolvedValue([{ affectedRows: 0 }, []]);
      mockEnd.mockResolvedValue(undefined);
    });

    it("connect() runs SELECT 1 then schema bootstrap", async () => {
      const adapter = createMysqlState({
        url: "mysql://root:root@localhost:3306/chat",
        logger: mockLogger,
      });
      await adapter.connect();
      const calls = mockExecute.mock.calls.map((c) => (c[0] as string).trim());
      expect(calls[0]).toBe("SELECT 1");
      expect(calls.some((s) => s.includes("chat_state_subscriptions"))).toBe(
        true
      );
    });

    it("connect() is idempotent", async () => {
      const adapter = createMysqlState({
        url: "mysql://root:root@localhost:3306/chat",
        logger: mockLogger,
      });
      await adapter.connect();
      const firstCount = mockExecute.mock.calls.length;
      await adapter.connect();
      expect(mockExecute.mock.calls.length).toBe(firstCount);
    });

    it("disconnect() ends pool when adapter owns it", async () => {
      const adapter = createMysqlState({
        url: "mysql://root:root@localhost:3306/chat",
        logger: mockLogger,
      });
      await adapter.connect();
      await adapter.disconnect();
      expect(mockEnd).toHaveBeenCalledOnce();
    });

    it("disconnect() does not end pool when client is external", async () => {
      const pool = createMockPool();
      const adapter = new MysqlStateAdapter({
        client: pool,
        logger: mockLogger,
      });
      (adapter as unknown as { connected: boolean }).connected = true;
      await adapter.disconnect();
      expect(pool.end).not.toHaveBeenCalled();
    });

    it("throws when connect() fails", async () => {
      mockExecute.mockRejectedValueOnce(new Error("connection refused"));
      const adapter = createMysqlState({
        url: "mysql://root:root@localhost:3306/chat",
        logger: mockLogger,
      });
      await expect(adapter.connect()).rejects.toThrow("connection refused");
    });

    it("throws when methods called before connect()", async () => {
      const adapter = createMysqlState({
        url: "mysql://root:root@localhost:3306/chat",
        logger: mockLogger,
      });
      await expect(adapter.isSubscribed("t1")).rejects.toThrow("not connected");
    });
  });

  describe("subscriptions", () => {
    let pool: mysql.Pool;
    let adapter: InstanceType<typeof MysqlStateAdapter>;

    beforeEach(() => {
      pool = createMockPool((sql) => {
        // Check the more specific pattern first to avoid "SELECT 1" matching
        // "SELECT 1 FROM chat_state_subscriptions".
        if (sql.includes("FROM chat_state_subscriptions")) {
          return [[{ 1: 1 }], []];
        }
        return [{ affectedRows: 1 }, []];
      });
      adapter = connectedAdapter(pool);
    });

    it("subscribe() runs INSERT IGNORE", async () => {
      await adapter.subscribe("thread-1");
      const sql = (pool.execute as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string;
      expect(sql).toMatch(RE_INSERT_IGNORE);
      expect(sql).toMatch(RE_SUBSCRIPTIONS_TABLE);
    });

    it("unsubscribe() runs DELETE", async () => {
      await adapter.unsubscribe("thread-1");
      const sql = (pool.execute as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string;
      expect(sql).toMatch(RE_DELETE_SUBSCRIPTIONS);
    });

    it("isSubscribed() returns true when row exists", async () => {
      const result = await adapter.isSubscribed("thread-1");
      expect(result).toBe(true);
    });

    it("isSubscribed() returns false when no row", async () => {
      const emptyPool = createMockPool(() => [[], []]);
      const emptyAdapter = connectedAdapter(emptyPool);
      const result = await emptyAdapter.isSubscribed("thread-1");
      expect(result).toBe(false);
    });
  });

  describe("locks", () => {
    it("acquireLock() returns Lock when upsert succeeds", async () => {
      const expires = new Date(Date.now() + 5000);
      const pool = createMockPool((sql) => {
        if (sql.includes("SELECT thread_id")) {
          return [
            [{ thread_id: "t1", token: "mysql_abc", expires_at: expires }],
            [],
          ];
        }
        return [{ affectedRows: 1 }, []];
      });
      const adapter = connectedAdapter(pool);
      const lock = await adapter.acquireLock("t1", 5000);
      expect(lock).not.toBeNull();
      expect(lock?.threadId).toBe("t1");
      expect(lock?.token).toMatch(RE_MYSQL_TOKEN);
    });

    it("acquireLock() returns null when lock is held", async () => {
      const pool = createMockPool((sql) => {
        if (sql.includes("SELECT thread_id")) {
          return [[], []];
        }
        return [{ affectedRows: 0 }, []];
      });
      const adapter = connectedAdapter(pool);
      const lock = await adapter.acquireLock("t1", 5000);
      expect(lock).toBeNull();
    });

    it("releaseLock() deletes by token", async () => {
      const pool = createMockPool(() => [{ affectedRows: 1 }, []]);
      const adapter = connectedAdapter(pool);
      const lock: Lock = {
        threadId: "t1",
        token: "mysql_tok",
        expiresAt: Date.now() + 1000,
      };
      await adapter.releaseLock(lock);
      const calls = (pool.execute as ReturnType<typeof vi.fn>).mock.calls;
      const sql = calls[0]?.[0] as string;
      const params = calls[0]?.[1] as unknown[];
      expect(sql).toMatch(RE_DELETE_LOCKS);
      expect(params).toContain("mysql_tok");
    });

    it("forceReleaseLock() deletes without token check", async () => {
      const pool = createMockPool(() => [{ affectedRows: 1 }, []]);
      const adapter = connectedAdapter(pool);
      await adapter.forceReleaseLock("t1");
      const calls = (pool.execute as ReturnType<typeof vi.fn>).mock.calls;
      const sql = calls[0]?.[0] as string;
      const params = calls[0]?.[1] as unknown[];
      expect(sql).toMatch(RE_DELETE_LOCKS);
      expect(params).toHaveLength(2); // key_prefix + thread_id only
    });

    it("extendLock() returns true when row updated", async () => {
      const pool = createMockPool(() => [{ affectedRows: 1 }, []]);
      const adapter = connectedAdapter(pool);
      const lock: Lock = {
        threadId: "t1",
        token: "mysql_tok",
        expiresAt: Date.now() + 1000,
      };
      const ok = await adapter.extendLock(lock, 5000);
      expect(ok).toBe(true);
    });

    it("extendLock() returns false when lock expired or token mismatch", async () => {
      const pool = createMockPool(() => [{ affectedRows: 0 }, []]);
      const adapter = connectedAdapter(pool);
      const lock: Lock = {
        threadId: "t1",
        token: "mysql_tok",
        expiresAt: Date.now() - 1000,
      };
      const ok = await adapter.extendLock(lock, 5000);
      expect(ok).toBe(false);
    });
  });

  describe("cache", () => {
    it("get() returns parsed JSON value", async () => {
      const pool = createMockPool((sql) => {
        if (sql.includes("SELECT value FROM chat_state_cache")) {
          return [[{ value: '{"x":1}' }], []];
        }
        return [{ affectedRows: 0 }, []];
      });
      const adapter = connectedAdapter(pool);
      const val = await adapter.get<{ x: number }>("key1");
      expect(val).toEqual({ x: 1 });
    });

    it("get() returns null and cleans up when no row", async () => {
      const pool = createMockPool(() => [[], []]);
      const adapter = connectedAdapter(pool);
      const val = await adapter.get("key1");
      expect(val).toBeNull();
      const calls = (pool.execute as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some((c) => (c[0] as string).includes("DELETE"))).toBe(true);
    });

    it("set() upserts with ON DUPLICATE KEY UPDATE", async () => {
      const pool = createMockPool(() => [{ affectedRows: 1 }, []]);
      const adapter = connectedAdapter(pool);
      await adapter.set("key1", { foo: "bar" });
      const sql = (pool.execute as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string;
      expect(sql).toMatch(RE_UPSERT_CACHE);
    });

    it("setIfNotExists() returns true when row inserted", async () => {
      const pool = createMockPool(() => [{ affectedRows: 1 }, []]);
      const adapter = connectedAdapter(pool);
      const ok = await adapter.setIfNotExists("key1", "val");
      expect(ok).toBe(true);
    });

    it("setIfNotExists() returns false when key already exists", async () => {
      const pool = createMockPool(() => [{ affectedRows: 0 }, []]);
      const adapter = connectedAdapter(pool);
      const ok = await adapter.setIfNotExists("key1", "val");
      expect(ok).toBe(false);
    });

    it("delete() removes the entry", async () => {
      const pool = createMockPool(() => [{ affectedRows: 1 }, []]);
      const adapter = connectedAdapter(pool);
      await adapter.delete("key1");
      const sql = (pool.execute as ReturnType<typeof vi.fn>).mock
        .calls[0]?.[0] as string;
      expect(sql).toMatch(RE_DELETE_CACHE);
    });
  });

  describe("lists", () => {
    it("appendToList() inserts then trims when maxLength set", async () => {
      const pool = createMockPool(() => [{ affectedRows: 1 }, []]);
      const adapter = connectedAdapter(pool);
      await adapter.appendToList("list1", "item", { maxLength: 5 });
      const calls = (pool.execute as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        calls.some((c) =>
          (c[0] as string).includes("INSERT INTO chat_state_lists")
        )
      ).toBe(true);
      expect(calls.some((c) => (c[0] as string).includes("NOT IN"))).toBe(true);
    });

    it("appendToList() refreshes TTL on all entries when ttlMs given", async () => {
      const pool = createMockPool(() => [{ affectedRows: 1 }, []]);
      const adapter = connectedAdapter(pool);
      await adapter.appendToList("list1", "item", { ttlMs: 1000 });
      const calls = (pool.execute as ReturnType<typeof vi.fn>).mock.calls;
      expect(
        calls.some((c) => (c[0] as string).includes("UPDATE chat_state_lists"))
      ).toBe(true);
    });

    it("getList() returns values in insertion order", async () => {
      const pool = createMockPool((sql) => {
        if (sql.includes("FROM chat_state_lists")) {
          return [[{ value: '"a"' }, { value: '"b"' }], []];
        }
        return [{ affectedRows: 0 }, []];
      });
      const adapter = connectedAdapter(pool);
      const list = await adapter.getList<string>("list1");
      expect(list).toEqual(["a", "b"]);
    });
  });

  describe("queue", () => {
    it("queueDepth() returns count of non-expired entries", async () => {
      const pool = createMockPool((sql) => {
        if (sql.includes("COUNT(*)")) {
          return [[{ depth: 3 }], []];
        }
        return [{ affectedRows: 0 }, []];
      });
      const adapter = connectedAdapter(pool);
      const depth = await adapter.queueDepth("t1");
      expect(depth).toBe(3);
    });

    it("dequeue() uses a transaction with FOR UPDATE", async () => {
      const mockConn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        execute: vi
          .fn()
          .mockResolvedValueOnce([{ affectedRows: 0 }, []])
          .mockResolvedValueOnce([
            [{ id: 1, value: '{"expiresAt":9999999999999,"enqueuedAt":1}' }],
            [],
          ])
          .mockResolvedValueOnce([{ affectedRows: 1 }, []]),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };
      const pool = createMockPool();
      (pool.getConnection as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConn
      );
      const adapter = connectedAdapter(pool);
      const entry = await adapter.dequeue("t1");
      expect(entry).not.toBeNull();
      expect(mockConn.beginTransaction).toHaveBeenCalled();
      expect(mockConn.commit).toHaveBeenCalled();
      const selectSql = mockConn.execute.mock.calls[1]?.[0] as string;
      expect(selectSql).toMatch(RE_FOR_UPDATE);
    });

    it("dequeue() returns null and rolls back when queue is empty", async () => {
      const mockConn = {
        beginTransaction: vi.fn().mockResolvedValue(undefined),
        execute: vi
          .fn()
          .mockResolvedValueOnce([{ affectedRows: 0 }, []])
          .mockResolvedValueOnce([[], []]),
        commit: vi.fn().mockResolvedValue(undefined),
        rollback: vi.fn().mockResolvedValue(undefined),
        release: vi.fn(),
      };
      const pool = createMockPool();
      (pool.getConnection as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockConn
      );
      const adapter = connectedAdapter(pool);
      const entry = await adapter.dequeue("t1");
      expect(entry).toBeNull();
      expect(mockConn.rollback).toHaveBeenCalled();
      expect(mockConn.commit).not.toHaveBeenCalled();
    });
  });

  describe("getClient()", () => {
    it("returns the underlying pool", () => {
      const pool = createMockPool();
      const adapter = new MysqlStateAdapter({
        client: pool,
        logger: mockLogger,
      });
      expect(adapter.getClient()).toBe(pool);
    });
  });
});
