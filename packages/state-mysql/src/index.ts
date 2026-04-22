import type { Lock, Logger, QueueEntry, StateAdapter } from "chat";
import { ConsoleLogger } from "chat";
import mysql from "mysql2/promise";

export interface MysqlStateAdapterOptions {
  /** Key prefix for all rows (default: "chat-sdk") */
  keyPrefix?: string;
  /** Logger instance for error reporting */
  logger?: Logger;
  /** MySQL connection URL */
  url: string;
}

export interface MysqlStateClientOptions {
  /** Existing mysql2 Pool instance */
  client: mysql.Pool;
  /** Key prefix for all rows (default: "chat-sdk") */
  keyPrefix?: string;
  /** Logger instance for error reporting */
  logger?: Logger;
}

export type CreateMysqlStateOptions =
  | (Partial<MysqlStateAdapterOptions> & { client?: never })
  | (Partial<Omit<MysqlStateClientOptions, "client">> & {
      client: mysql.Pool;
    });

export class MysqlStateAdapter implements StateAdapter {
  private readonly pool: mysql.Pool;
  private readonly keyPrefix: string;
  private readonly logger: Logger;
  private readonly ownsClient: boolean;
  private connected = false;
  private connectPromise: Promise<void> | null = null;

  constructor(options: MysqlStateAdapterOptions | MysqlStateClientOptions) {
    if ("client" in options) {
      this.pool = options.client;
      this.ownsClient = false;
    } else {
      this.pool = mysql.createPool(options.url);
      this.ownsClient = true;
    }

    this.keyPrefix = options.keyPrefix ?? "chat-sdk";
    this.logger = options.logger ?? new ConsoleLogger("info").child("mysql");
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (!this.connectPromise) {
      this.connectPromise = (async () => {
        try {
          await this.pool.execute("SELECT 1");
          await this.ensureSchema();
          this.connected = true;
        } catch (error) {
          this.connectPromise = null;
          this.logger.error("MySQL connect failed", { error });
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
      await this.pool.end();
    }
    this.connected = false;
    this.connectPromise = null;
  }

  async subscribe(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.pool.execute(
      "INSERT IGNORE INTO chat_state_subscriptions (key_prefix, thread_id) VALUES (?, ?)",
      [this.keyPrefix, threadId]
    );
  }

  async unsubscribe(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.pool.execute(
      "DELETE FROM chat_state_subscriptions WHERE key_prefix = ? AND thread_id = ?",
      [this.keyPrefix, threadId]
    );
  }

  async isSubscribed(threadId: string): Promise<boolean> {
    this.ensureConnected();
    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      "SELECT 1 FROM chat_state_subscriptions WHERE key_prefix = ? AND thread_id = ? LIMIT 1",
      [this.keyPrefix, threadId]
    );
    return rows.length > 0;
  }

  async acquireLock(threadId: string, ttlMs: number): Promise<Lock | null> {
    this.ensureConnected();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + ttlMs);

    // Conditional upsert: update only if the existing lock is expired.
    // In ON DUPLICATE KEY UPDATE, bare column names refer to the existing row.
    await this.pool.execute(
      `INSERT INTO chat_state_locks (key_prefix, thread_id, token, expires_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         token = IF(expires_at <= NOW(3), VALUES(token), token),
         expires_at = IF(expires_at <= NOW(3), VALUES(expires_at), expires_at),
         updated_at = IF(expires_at <= NOW(3), NOW(3), updated_at)`,
      [this.keyPrefix, threadId, token, expiresAt]
    );

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT thread_id, token, expires_at FROM chat_state_locks
       WHERE key_prefix = ? AND thread_id = ? AND token = ?`,
      [this.keyPrefix, threadId, token]
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      threadId: row.thread_id as string,
      token: row.token as string,
      expiresAt: (row.expires_at as Date).getTime(),
    };
  }

  async forceReleaseLock(threadId: string): Promise<void> {
    this.ensureConnected();
    await this.pool.execute(
      "DELETE FROM chat_state_locks WHERE key_prefix = ? AND thread_id = ?",
      [this.keyPrefix, threadId]
    );
  }

  async releaseLock(lock: Lock): Promise<void> {
    this.ensureConnected();
    await this.pool.execute(
      "DELETE FROM chat_state_locks WHERE key_prefix = ? AND thread_id = ? AND token = ?",
      [this.keyPrefix, lock.threadId, lock.token]
    );
  }

  async extendLock(lock: Lock, ttlMs: number): Promise<boolean> {
    this.ensureConnected();
    const expiresAt = new Date(Date.now() + ttlMs);
    const [result] = await this.pool.execute<mysql.ResultSetHeader>(
      `UPDATE chat_state_locks
       SET expires_at = ?, updated_at = NOW(3)
       WHERE key_prefix = ? AND thread_id = ? AND token = ? AND expires_at > NOW(3)`,
      [expiresAt, this.keyPrefix, lock.threadId, lock.token]
    );
    return result.affectedRows > 0;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.ensureConnected();
    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT value FROM chat_state_cache
       WHERE key_prefix = ? AND cache_key = ? AND (expires_at IS NULL OR expires_at > NOW(3))
       LIMIT 1`,
      [this.keyPrefix, key]
    );

    if (rows.length === 0) {
      // Opportunistic cleanup of expired entry
      await this.pool.execute(
        "DELETE FROM chat_state_cache WHERE key_prefix = ? AND cache_key = ? AND expires_at <= NOW(3)",
        [this.keyPrefix, key]
      );
      return null;
    }

    const hit = rows[0];
    if (!hit) {
      return null;
    }

    try {
      return JSON.parse(hit.value as string) as T;
    } catch {
      return hit.value as unknown as T;
    }
  }

  async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    this.ensureConnected();
    const serialized = JSON.stringify(value);
    const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : null;
    await this.pool.execute(
      `INSERT INTO chat_state_cache (key_prefix, cache_key, value, expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         value = VALUES(value),
         expires_at = VALUES(expires_at),
         updated_at = NOW(3)`,
      [this.keyPrefix, key, serialized, expiresAt]
    );
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttlMs?: number
  ): Promise<boolean> {
    this.ensureConnected();
    const serialized = JSON.stringify(value);
    const expiresAt = ttlMs ? new Date(Date.now() + ttlMs) : null;
    const [result] = await this.pool.execute<mysql.ResultSetHeader>(
      "INSERT IGNORE INTO chat_state_cache (key_prefix, cache_key, value, expires_at) VALUES (?, ?, ?, ?)",
      [this.keyPrefix, key, serialized, expiresAt]
    );
    return result.affectedRows > 0;
  }

  async delete(key: string): Promise<void> {
    this.ensureConnected();
    await this.pool.execute(
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
    const serialized = JSON.stringify(value);
    const expiresAt = options?.ttlMs
      ? new Date(Date.now() + options.ttlMs)
      : null;

    await this.pool.execute(
      "INSERT INTO chat_state_lists (key_prefix, list_key, value, expires_at) VALUES (?, ?, ?, ?)",
      [this.keyPrefix, key, serialized, expiresAt]
    );

    if (options?.maxLength) {
      // Keep newest maxLength entries, delete the rest.
      // The double-subquery is required because MySQL won't let you DELETE and SELECT
      // the same table in a single subquery without wrapping it in a derived table.
      await this.pool.execute(
        `DELETE FROM chat_state_lists
         WHERE key_prefix = ? AND list_key = ? AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM chat_state_lists
             WHERE key_prefix = ? AND list_key = ?
             ORDER BY id DESC
             LIMIT ?
           ) AS keep
         )`,
        [this.keyPrefix, key, this.keyPrefix, key, options.maxLength]
      );
    }

    if (expiresAt) {
      await this.pool.execute(
        "UPDATE chat_state_lists SET expires_at = ? WHERE key_prefix = ? AND list_key = ?",
        [expiresAt, this.keyPrefix, key]
      );
    }
  }

  async getList<T = unknown>(key: string): Promise<T[]> {
    this.ensureConnected();
    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT value FROM chat_state_lists
       WHERE key_prefix = ? AND list_key = ? AND (expires_at IS NULL OR expires_at > NOW(3))
       ORDER BY id ASC`,
      [this.keyPrefix, key]
    );
    return rows.map((row) => JSON.parse(row.value as string) as T);
  }

  async enqueue(
    threadId: string,
    entry: QueueEntry,
    maxSize: number
  ): Promise<number> {
    this.ensureConnected();
    const serialized = JSON.stringify(entry);
    const expiresAt = new Date(entry.expiresAt);

    await this.pool.execute(
      "DELETE FROM chat_state_queues WHERE key_prefix = ? AND thread_id = ? AND expires_at <= NOW(3)",
      [this.keyPrefix, threadId]
    );

    await this.pool.execute(
      "INSERT INTO chat_state_queues (key_prefix, thread_id, value, expires_at) VALUES (?, ?, ?, ?)",
      [this.keyPrefix, threadId, serialized, expiresAt]
    );

    if (maxSize > 0) {
      await this.pool.execute(
        `DELETE FROM chat_state_queues
         WHERE key_prefix = ? AND thread_id = ? AND expires_at > NOW(3) AND id NOT IN (
           SELECT id FROM (
             SELECT id FROM chat_state_queues
             WHERE key_prefix = ? AND thread_id = ? AND expires_at > NOW(3)
             ORDER BY id DESC
             LIMIT ?
           ) AS keep
         )`,
        [this.keyPrefix, threadId, this.keyPrefix, threadId, maxSize]
      );
    }

    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS depth FROM chat_state_queues
       WHERE key_prefix = ? AND thread_id = ? AND expires_at > NOW(3)`,
      [this.keyPrefix, threadId]
    );

    return Number(rows[0]?.depth ?? 0);
  }

  async dequeue(threadId: string): Promise<QueueEntry | null> {
    this.ensureConnected();

    // MySQL has no DELETE...RETURNING, so we use a transaction with SELECT FOR UPDATE.
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        "DELETE FROM chat_state_queues WHERE key_prefix = ? AND thread_id = ? AND expires_at <= NOW(3)",
        [this.keyPrefix, threadId]
      );

      const [rows] = await conn.execute<mysql.RowDataPacket[]>(
        `SELECT id, value FROM chat_state_queues
         WHERE key_prefix = ? AND thread_id = ? AND expires_at > NOW(3)
         ORDER BY id ASC LIMIT 1 FOR UPDATE`,
        [this.keyPrefix, threadId]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return null;
      }

      const row = rows[0];
      if (!row) {
        await conn.rollback();
        return null;
      }

      await conn.execute(
        "DELETE FROM chat_state_queues WHERE key_prefix = ? AND thread_id = ? AND id = ?",
        [this.keyPrefix, threadId, row.id]
      );

      await conn.commit();
      return JSON.parse(row.value as string) as QueueEntry;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async queueDepth(threadId: string): Promise<number> {
    this.ensureConnected();
    const [rows] = await this.pool.execute<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS depth FROM chat_state_queues
       WHERE key_prefix = ? AND thread_id = ? AND expires_at > NOW(3)`,
      [this.keyPrefix, threadId]
    );
    return Number(rows[0]?.depth ?? 0);
  }

  getClient(): mysql.Pool {
    return this.pool;
  }

  private async ensureSchema(): Promise<void> {
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS chat_state_subscriptions (
        key_prefix VARCHAR(255) NOT NULL,
        thread_id  VARCHAR(255) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (key_prefix, thread_id)
      )
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS chat_state_locks (
        key_prefix VARCHAR(255) NOT NULL,
        thread_id  VARCHAR(255) NOT NULL,
        token      VARCHAR(255) NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (key_prefix, thread_id)
      )
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS chat_state_cache (
        key_prefix VARCHAR(255) NOT NULL,
        cache_key  VARCHAR(255) NOT NULL,
        value      TEXT         NOT NULL,
        expires_at DATETIME(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (key_prefix, cache_key)
      )
    `);

    // AUTO_INCREMENT requires the column to be a standalone PRIMARY KEY in InnoDB
    // when the PK is composite. We use a surrogate `id` here and index the logical key.
    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS chat_state_lists (
        id         BIGINT       NOT NULL AUTO_INCREMENT,
        key_prefix VARCHAR(255) NOT NULL,
        list_key   VARCHAR(255) NOT NULL,
        value      TEXT         NOT NULL,
        expires_at DATETIME(3),
        PRIMARY KEY (id),
        KEY idx_list_lookup (key_prefix, list_key, id)
      )
    `);

    await this.pool.execute(`
      CREATE TABLE IF NOT EXISTS chat_state_queues (
        id         BIGINT       NOT NULL AUTO_INCREMENT,
        key_prefix VARCHAR(255) NOT NULL,
        thread_id  VARCHAR(255) NOT NULL,
        value      TEXT         NOT NULL,
        expires_at DATETIME(3) NOT NULL,
        PRIMARY KEY (id),
        KEY idx_queue_lookup (key_prefix, thread_id, id)
      )
    `);

    await this.pool.execute(
      "CREATE INDEX IF NOT EXISTS chat_state_locks_expires_idx ON chat_state_locks (expires_at)"
    );
    await this.pool.execute(
      "CREATE INDEX IF NOT EXISTS chat_state_cache_expires_idx ON chat_state_cache (expires_at)"
    );
    await this.pool.execute(
      "CREATE INDEX IF NOT EXISTS chat_state_lists_expires_idx ON chat_state_lists (expires_at)"
    );
    await this.pool.execute(
      "CREATE INDEX IF NOT EXISTS chat_state_queues_expires_idx ON chat_state_queues (expires_at)"
    );
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error(
        "MysqlStateAdapter is not connected. Call connect() first."
      );
    }
  }
}

function generateToken(): string {
  return `mysql_${crypto.randomUUID()}`;
}

export function createMysqlState(
  options: CreateMysqlStateOptions = {}
): MysqlStateAdapter {
  if ("client" in options && options.client) {
    return new MysqlStateAdapter({
      client: options.client,
      keyPrefix: options.keyPrefix,
      logger: options.logger,
    });
  }

  const url =
    (options as Partial<MysqlStateAdapterOptions>).url ||
    process.env.MYSQL_URL ||
    process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      "MySQL url is required. Set MYSQL_URL or DATABASE_URL, or provide it in options."
    );
  }

  return new MysqlStateAdapter({
    url,
    keyPrefix: options.keyPrefix,
    logger: options.logger,
  });
}
