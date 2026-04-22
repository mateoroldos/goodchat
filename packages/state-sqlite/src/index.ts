import type {
  Database as BunSqliteDatabase,
  SQLQueryBindings,
} from "bun:sqlite";
import type { Lock, Logger, QueueEntry, StateAdapter } from "chat";
import { ConsoleLogger } from "chat";

export interface SqliteStateAdapterOptions {
  /** Key prefix for all rows (default: "chat-sdk") */
  keyPrefix?: string;
  /** Logger instance for error reporting */
  logger?: Logger;
  /** Path to SQLite file (default: ":memory:") */
  path?: string;
}

export interface SqliteStateClientOptions {
  /** Existing BunSqliteDatabase instance */
  client: BunSqliteDatabase;
  /** Key prefix for all rows (default: "chat-sdk") */
  keyPrefix?: string;
  /** Logger instance for error reporting */
  logger?: Logger;
}

export type CreateSqliteStateOptions =
  | (Partial<SqliteStateAdapterOptions> & { client?: never })
  | (Partial<Omit<SqliteStateClientOptions, "client">> & {
      client: BunSqliteDatabase;
    });

interface LockRow {
  expires_at: number;
  thread_id: string;
  token: string;
}

interface ValueRow {
  value: string;
}

interface CountRow {
  depth: number;
}

interface IdValueRow {
  id: number;
  value: string;
}

interface ChangesRow {
  n: number;
}

interface RunResult {
  changes: number;
}

export class SqliteStateAdapter implements StateAdapter {
  private db!: BunSqliteDatabase;
  private readonly keyPrefix: string;
  private readonly logger: Logger;
  private readonly ownsClient: boolean;
  private readonly path: string;
  private connected = false;
  private connectPromise: Promise<void> | null = null;

  constructor(
    options: SqliteStateAdapterOptions | SqliteStateClientOptions = {}
  ) {
    if ("client" in options) {
      this.db = options.client;
      this.ownsClient = false;
      this.path = ":memory:";
    } else {
      this.path = options.path ?? ":memory:";
      this.ownsClient = true;
    }
    this.keyPrefix = options.keyPrefix ?? "chat-sdk";
    this.logger = options.logger ?? new ConsoleLogger("info").child("sqlite");
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (!this.connectPromise) {
      this.connectPromise = (async () => {
        try {
          if (this.ownsClient) {
            if (!("Bun" in globalThis)) {
              throw new Error("SQLite state adapter requires Bun runtime");
            }
            const sqlite = await import("bun:sqlite");
            this.db = new sqlite.Database(this.path);
          }
          await this.execute(() => {
            this.db.run("SELECT 1");
          });
          this.ensureSchema();
          this.connected = true;
        } catch (error) {
          this.connectPromise = null;
          this.logger.error("SQLite connect failed", { error });
          throw error;
        }
      })();
    }
    await this.connectPromise;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }
    if (this.ownsClient) {
      await this.execute(() => {
        this.db.close();
      });
    }
    this.connected = false;
    this.connectPromise = null;
  }

  async subscribe(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.run(
      "INSERT OR IGNORE INTO chat_state_subscriptions (key_prefix, thread_id) VALUES (?, ?)",
      [this.keyPrefix, threadId]
    );
  }

  async unsubscribe(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.run(
      "DELETE FROM chat_state_subscriptions WHERE key_prefix = ? AND thread_id = ?",
      [this.keyPrefix, threadId]
    );
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    this.ensureConnected();
    const row = await this.getRow<unknown>(
      "SELECT 1 FROM chat_state_subscriptions WHERE key_prefix = ? AND thread_id = ? LIMIT 1",
      [this.keyPrefix, threadId]
    );
    return row !== null;
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    this.ensureConnected();
    const token = generateToken();
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const row = await this.withImmediateTransaction(() => {
      this.db
        .prepare(
          `UPDATE chat_state_locks
           SET token = ?, expires_at = ?, updated_at = ?
           WHERE key_prefix = ? AND thread_id = ? AND expires_at <= ?`
        )
        .run(token, expiresAt, now, this.keyPrefix, threadId, now);

      this.db
        .prepare(
          `INSERT OR IGNORE INTO chat_state_locks (key_prefix, thread_id, token, expires_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(this.keyPrefix, threadId, token, expiresAt, now);

      return this.db
        .prepare(
          "SELECT thread_id, token, expires_at FROM chat_state_locks WHERE key_prefix = ? AND thread_id = ?"
        )
        .get(this.keyPrefix, threadId) as LockRow | null;
    });

    if (!row || row.token !== token) {
      return null;
    }

    return {
      threadId: row.thread_id,
      token: row.token,
      expiresAt: row.expires_at,
    };
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.run(
      "DELETE FROM chat_state_locks WHERE key_prefix = ? AND thread_id = ?",
      [this.keyPrefix, threadId]
    );
  }

  async releaseLock(lock: Lock): Promise<void> {
    this.ensureConnected();
    await this.run(
      "DELETE FROM chat_state_locks WHERE key_prefix = ? AND thread_id = ? AND token = ?",
      [this.keyPrefix, lock.threadId, lock.token]
    );
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    this.ensureConnected();
    const now = Date.now();
    const expiresAt = new Date(Date.now() + ttlMs).getTime();
    const result = await this.run(
      `UPDATE chat_state_locks
       SET expires_at = ?, updated_at = ?
       WHERE key_prefix = ? AND thread_id = ? AND token = ? AND expires_at > ?`,
      [expiresAt, now, this.keyPrefix, lock.threadId, lock.token, now]
    );
    return result.changes > 0;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.ensureConnected();
    const now = Date.now();
    const row = await this.getRow<ValueRow>(
      `SELECT value FROM chat_state_cache
       WHERE key_prefix = ? AND cache_key = ? AND (expires_at IS NULL OR expires_at > ?)
       LIMIT 1`,
      [this.keyPrefix, key, now]
    );

    if (!row) {
      await this.run(
        "DELETE FROM chat_state_cache WHERE key_prefix = ? AND cache_key = ? AND expires_at <= ?",
        [this.keyPrefix, key, now]
      );
      return null;
    }

    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.ensureConnected();
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    await this.run(
      `INSERT OR REPLACE INTO chat_state_cache (key_prefix, cache_key, value, expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [this.keyPrefix, key, JSON.stringify(value), expiresAt, Date.now()]
    );
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttlMs?: number
  ): Promise<boolean> {
    this.ensureConnected();
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    await this.run(
      "INSERT OR IGNORE INTO chat_state_cache (key_prefix, cache_key, value, expires_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [this.keyPrefix, key, JSON.stringify(value), expiresAt, Date.now()]
    );
    const row = await this.getRow<ChangesRow>("SELECT changes() AS n");
    return (row?.n ?? 0) > 0;
  }

  async delete(key: string): Promise<void> {
    this.ensureConnected();
    await this.run(
      "DELETE FROM chat_state_cache WHERE key_prefix = ? AND cache_key = ?",
      [this.keyPrefix, key]
    );
  }

  async appendToList(
    key: string,
    value: unknown,
    options?: { maxLength?: number; ttlMs?: number }
  ): Promise<void> {
    this.ensureConnected();
    const expiresAt = options?.ttlMs ? Date.now() + options.ttlMs : null;

    await this.run(
      "INSERT INTO chat_state_lists (key_prefix, list_key, value, expires_at) VALUES (?, ?, ?, ?)",
      [this.keyPrefix, key, JSON.stringify(value), expiresAt]
    );

    if (options?.maxLength) {
      await this.run(
        `DELETE FROM chat_state_lists
         WHERE key_prefix = ? AND list_key = ? AND id NOT IN (
           SELECT id FROM chat_state_lists
           WHERE key_prefix = ? AND list_key = ?
           ORDER BY id DESC
           LIMIT ?
         )`,
        [this.keyPrefix, key, this.keyPrefix, key, options.maxLength]
      );
    }

    if (expiresAt) {
      await this.run(
        "UPDATE chat_state_lists SET expires_at = ? WHERE key_prefix = ? AND list_key = ?",
        [expiresAt, this.keyPrefix, key]
      );
    }
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    this.ensureConnected();
    const now = Date.now();
    const rows = await this.getRows<ValueRow>(
      `SELECT value FROM chat_state_lists
       WHERE key_prefix = ? AND list_key = ? AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY id ASC`,
      [this.keyPrefix, key, now]
    );
    return rows.map((row) => JSON.parse(row.value) as T);
  }

  async enqueue(
    threadId: string,
    entry: QueueEntry,
    maxSize: number
  ): Promise<number> {
    this.ensureConnected();
    const now = Date.now();

    await this.run(
      "DELETE FROM chat_state_queues WHERE key_prefix = ? AND thread_id = ? AND expires_at <= ?",
      [this.keyPrefix, threadId, now]
    );

    await this.run(
      "INSERT INTO chat_state_queues (key_prefix, thread_id, value, expires_at) VALUES (?, ?, ?, ?)",
      [this.keyPrefix, threadId, JSON.stringify(entry), entry.expiresAt]
    );

    if (maxSize > 0) {
      await this.run(
        `DELETE FROM chat_state_queues
         WHERE key_prefix = ? AND thread_id = ? AND expires_at > ? AND id NOT IN (
           SELECT id FROM chat_state_queues
           WHERE key_prefix = ? AND thread_id = ? AND expires_at > ?
           ORDER BY id DESC
           LIMIT ?
         )`,
        [this.keyPrefix, threadId, now, this.keyPrefix, threadId, now, maxSize]
      );
    }

    const row = await this.getRow<CountRow>(
      `SELECT COUNT(*) AS depth FROM chat_state_queues
       WHERE key_prefix = ? AND thread_id = ? AND expires_at > ?`,
      [this.keyPrefix, threadId, now]
    );

    return row?.depth ?? 0;
  }

  async dequeue(threadId: string): Promise<QueueEntry | null> {
    this.ensureConnected();
    const now = Date.now();

    return await this.withImmediateTransaction(() => {
      this.db
        .prepare(
          "DELETE FROM chat_state_queues WHERE key_prefix = ? AND thread_id = ? AND expires_at <= ?"
        )
        .run(this.keyPrefix, threadId, now);

      const row = this.db
        .prepare(
          `SELECT id, value FROM chat_state_queues
           WHERE key_prefix = ? AND thread_id = ? AND expires_at > ?
           ORDER BY id ASC LIMIT 1`
        )
        .get(this.keyPrefix, threadId, now) as IdValueRow | null;

      if (!row) {
        return null;
      }

      this.db
        .prepare(
          "DELETE FROM chat_state_queues WHERE key_prefix = ? AND thread_id = ? AND id = ?"
        )
        .run(this.keyPrefix, threadId, row.id);

      return JSON.parse(row.value) as QueueEntry;
    });
  }

  async queueDepth(threadId: string): Promise<number> {
    this.ensureConnected();
    const now = Date.now();
    const row = await this.getRow<CountRow>(
      `SELECT COUNT(*) AS depth FROM chat_state_queues
       WHERE key_prefix = ? AND thread_id = ? AND expires_at > ?`,
      [this.keyPrefix, threadId, now]
    );
    return row?.depth ?? 0;
  }

  getClient(): BunSqliteDatabase {
    this.ensureConnected();
    return this.db;
  }

  private ensureSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_state_subscriptions (
        key_prefix TEXT    NOT NULL,
        thread_id  TEXT    NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        PRIMARY KEY (key_prefix, thread_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_state_locks (
        key_prefix TEXT    NOT NULL,
        thread_id  TEXT    NOT NULL,
        token      TEXT    NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (key_prefix, thread_id)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_state_cache (
        key_prefix TEXT    NOT NULL,
        cache_key  TEXT    NOT NULL,
        value      TEXT    NOT NULL,
        expires_at INTEGER,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
        PRIMARY KEY (key_prefix, cache_key)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_state_lists (
        id         INTEGER PRIMARY KEY,
        key_prefix TEXT    NOT NULL,
        list_key   TEXT    NOT NULL,
        value      TEXT    NOT NULL,
        expires_at INTEGER
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_state_queues (
        id         INTEGER PRIMARY KEY,
        key_prefix TEXT    NOT NULL,
        thread_id  TEXT    NOT NULL,
        value      TEXT    NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);

    this.db.run(
      "CREATE INDEX IF NOT EXISTS chat_state_list_lookup ON chat_state_lists (key_prefix, list_key)"
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS chat_state_queue_lookup ON chat_state_queues (key_prefix, thread_id)"
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS chat_state_locks_expires_idx ON chat_state_locks (expires_at)"
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS chat_state_cache_expires_idx ON chat_state_cache (expires_at)"
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS chat_state_lists_expires_idx ON chat_state_lists (expires_at)"
    );
    this.db.run(
      "CREATE INDEX IF NOT EXISTS chat_state_queues_expires_idx ON chat_state_queues (expires_at)"
    );
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        "SqliteStateAdapter is not connected. Call connect() first."
      );
    }
  }

  private execute<T>(operation: () => T): Promise<T> {
    return Promise.resolve(operation());
  }

  private run(
    sql: string,
    params: SQLQueryBindings[] = []
  ): Promise<RunResult> {
    return this.execute(
      () => this.db.prepare(sql).run(...params) as unknown as RunResult
    );
  }

  private getRow<T>(
    sql: string,
    params: SQLQueryBindings[] = []
  ): Promise<T | null> {
    return this.execute(
      () => this.db.prepare(sql).get(...params) as T | null
    ).then((row) => row ?? null);
  }

  private getRows<T>(
    sql: string,
    params: SQLQueryBindings[] = []
  ): Promise<T[]> {
    return this.execute(() => this.db.prepare(sql).all(...params) as T[]);
  }

  private withImmediateTransaction<T>(operation: () => T): Promise<T> {
    return this.execute(() => {
      this.db.run("BEGIN IMMEDIATE");
      try {
        const result = operation();
        this.db.run("COMMIT");
        return result;
      } catch (error) {
        try {
          this.db.run("ROLLBACK");
        } catch {
          // no-op
        }
        throw error;
      }
    });
  }
}

function generateToken(): string {
  return `sqlite_${crypto.randomUUID()}`;
}

export function createSqliteState(
  options: CreateSqliteStateOptions = {}
): SqliteStateAdapter {
  return new SqliteStateAdapter(options);
}
