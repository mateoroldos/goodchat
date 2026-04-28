import type { Database } from "@goodchat/contracts/database/interface";
import { and, eq, gte, sql } from "drizzle-orm";
import { rateLimitSchema as rateLimitMysqlSchema } from "../schemas/mysql";
import { rateLimitSchema as rateLimitPostgresSchema } from "../schemas/postgres";
import { rateLimitSchema as rateLimitSqliteSchema } from "../schemas/sqlite";
import type { RateLimitRepository } from "./types";

interface Conn {
  delete(table: unknown): { where(cond: unknown): Promise<void> };
  insert(table: unknown): { values(row: unknown): Promise<void> };
  select(fields: unknown): {
    from(table: unknown): { where(cond: unknown): Promise<unknown[]> };
  };
  update(table: unknown): {
    set(values: unknown): { where(cond: unknown): Promise<void> };
  };
}

const SYNC_CURSOR_ROW_ID = "global";

type TokenBucketGranularity = "day" | "hour" | "month";

const toBucketStart = (
  createdAt: string,
  granularity: TokenBucketGranularity
): string => {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  if (granularity === "hour") {
    date.setUTCMinutes(0, 0, 0);
  } else if (granularity === "day") {
    date.setUTCHours(0, 0, 0, 0);
  } else {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  }

  return date.toISOString();
};

const listAllThreadIds = async (db: Database): Promise<string[]> => {
  const ids: string[] = [];
  let cursor: { createdAt: string; id: string } | undefined;

  while (true) {
    const page = await db.threads.list({
      ...(cursor ? { cursor } : {}),
      limit: 100,
      sort: "asc",
    });
    if (page.length === 0) {
      return ids;
    }
    for (const thread of page) {
      ids.push(thread.id);
    }
    const last = page.at(-1);
    if (!last) {
      return ids;
    }
    cursor = { createdAt: last.createdAt, id: last.id };
  }
};

const listAllAiRunsForThread = async (
  db: Database,
  threadId: string
): Promise<
  Array<{
    createdAt: string;
    id: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    userId: string;
  }>
> => {
  const runs: Array<{
    createdAt: string;
    id: string;
    inputTokens?: number | null;
    outputTokens?: number | null;
    userId: string;
  }> = [];
  let cursor: { createdAt: string; id: string } | undefined;

  while (true) {
    const page = await db.aiRuns.listByThread({
      ...(cursor ? { cursor } : {}),
      limit: 100,
      sort: "asc",
      threadId,
    });
    if (page.length === 0) {
      return runs;
    }
    for (const run of page) {
      runs.push({
        createdAt: run.createdAt,
        id: run.id,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        userId: run.userId,
      });
    }
    const last = page.at(-1);
    if (!last) {
      return runs;
    }
    cursor = { createdAt: last.createdAt, id: last.id };
  }
};

export const hasDatabaseShape = (db: unknown): db is Database => {
  return (
    db !== null &&
    typeof db === "object" &&
    "threads" in db &&
    typeof (db as { threads?: { list?: unknown } }).threads?.list ===
      "function" &&
    "aiRuns" in db &&
    typeof (db as { aiRuns?: { listByThread?: unknown } }).aiRuns
      ?.listByThread === "function"
  );
};

export const createDatabaseRateLimitRepository = (
  db: Database
): RateLimitRepository => {
  let tableSet:
    | typeof rateLimitSqliteSchema
    | typeof rateLimitPostgresSchema
    | typeof rateLimitMysqlSchema = rateLimitSqliteSchema;
  if (db.dialect === "postgres") {
    tableSet = rateLimitPostgresSchema;
  }
  if (db.dialect === "mysql") {
    tableSet = rateLimitMysqlSchema;
  }

  const conn = db.connection as unknown as Conn;

  const isRunAfterCursor = (
    run: { createdAt: string; id: string },
    cursor?: { createdAt: string; runId: string }
  ) => {
    if (!cursor) {
      return true;
    }
    if (run.createdAt > cursor.createdAt) {
      return true;
    }
    if (run.createdAt < cursor.createdAt) {
      return false;
    }
    return run.id > cursor.runId;
  };

  const readSyncCursor = async () => {
    const rows = (await conn
      .select({
        cursorCreatedAt: tableSet.rateLimitTokenUsageSync.cursorCreatedAt,
        cursorRunId: tableSet.rateLimitTokenUsageSync.cursorRunId,
      })
      .from(tableSet.rateLimitTokenUsageSync)
      .where(
        eq(tableSet.rateLimitTokenUsageSync.id, SYNC_CURSOR_ROW_ID)
      )) as Array<{
      cursorCreatedAt: string;
      cursorRunId: string;
    }>;
    const row = rows.at(0);
    if (!row) {
      return undefined;
    }
    return { createdAt: row.cursorCreatedAt, runId: row.cursorRunId };
  };

  const writeSyncCursor = async (cursor: {
    createdAt: string;
    runId: string;
  }) => {
    const nowIso = new Date().toISOString();
    const existing = (await conn
      .select({ id: tableSet.rateLimitTokenUsageSync.id })
      .from(tableSet.rateLimitTokenUsageSync)
      .where(
        eq(tableSet.rateLimitTokenUsageSync.id, SYNC_CURSOR_ROW_ID)
      )) as Array<{
      id: string;
    }>;

    if (existing.length === 0) {
      await conn.insert(tableSet.rateLimitTokenUsageSync).values({
        cursorCreatedAt: cursor.createdAt,
        cursorRunId: cursor.runId,
        id: SYNC_CURSOR_ROW_ID,
        updatedAt: nowIso,
      });
      return;
    }

    await conn
      .update(tableSet.rateLimitTokenUsageSync)
      .set({
        cursorCreatedAt: cursor.createdAt,
        cursorRunId: cursor.runId,
        updatedAt: nowIso,
      })
      .where(eq(tableSet.rateLimitTokenUsageSync.id, SYNC_CURSOR_ROW_ID));
  };

  const incrementTokenBucket = async (input: {
    createdAt: string;
    granularity: TokenBucketGranularity;
    tokens: number;
    userId: string;
  }) => {
    const bucketStart = toBucketStart(input.createdAt, input.granularity);
    const rows = (await conn
      .select({ tokens: tableSet.rateLimitTokenUsage.tokens })
      .from(tableSet.rateLimitTokenUsage)
      .where(
        and(
          eq(tableSet.rateLimitTokenUsage.userId, input.userId),
          eq(tableSet.rateLimitTokenUsage.bucketGranularity, input.granularity),
          eq(tableSet.rateLimitTokenUsage.bucketStart, bucketStart)
        )
      )) as Array<{ tokens: number }>;

    if (rows.length === 0) {
      await conn.insert(tableSet.rateLimitTokenUsage).values({
        bucketGranularity: input.granularity,
        bucketStart,
        tokens: input.tokens,
        updatedAt: input.createdAt,
        userId: input.userId,
      });
      return;
    }

    await conn
      .update(tableSet.rateLimitTokenUsage)
      .set({
        tokens: (rows[0]?.tokens ?? 0) + input.tokens,
        updatedAt: input.createdAt,
      })
      .where(
        and(
          eq(tableSet.rateLimitTokenUsage.userId, input.userId),
          eq(tableSet.rateLimitTokenUsage.bucketGranularity, input.granularity),
          eq(tableSet.rateLimitTokenUsage.bucketStart, bucketStart)
        )
      );
  };

  const syncTokenBuckets = async () => {
    const cursor = await readSyncCursor();
    const threadIds = await listAllThreadIds(db);
    const pendingRuns: Array<{
      createdAt: string;
      id: string;
      inputTokens?: number | null;
      outputTokens?: number | null;
      userId: string;
    }> = [];

    for (const threadId of threadIds) {
      const runs = await listAllAiRunsForThread(db, threadId);
      for (const run of runs) {
        if (isRunAfterCursor(run, cursor)) {
          pendingRuns.push(run);
        }
      }
    }

    pendingRuns.sort((a, b) => {
      if (a.createdAt === b.createdAt) {
        return a.id.localeCompare(b.id);
      }
      return a.createdAt.localeCompare(b.createdAt);
    });

    let last: { createdAt: string; runId: string } | undefined;
    for (const run of pendingRuns) {
      const tokens = (run.inputTokens ?? 0) + (run.outputTokens ?? 0);
      if (tokens > 0) {
        await incrementTokenBucket({
          createdAt: run.createdAt,
          granularity: "hour",
          tokens,
          userId: run.userId,
        });
        await incrementTokenBucket({
          createdAt: run.createdAt,
          granularity: "day",
          tokens,
          userId: run.userId,
        });
        await incrementTokenBucket({
          createdAt: run.createdAt,
          granularity: "month",
          tokens,
          userId: run.userId,
        });
      }
      last = { createdAt: run.createdAt, runId: run.id };
    }

    if (last) {
      await writeSyncCursor(last);
    }
  };

  return {
    async acquireLease(input) {
      const nowIso = input.now.toISOString();
      const expiryIso = new Date(
        input.now.getTime() + input.ttlMs
      ).toISOString();
      let acquired = false;

      await db.transaction(async (tx) => {
        const txConn = tx.connection as unknown as Conn;

        await txConn
          .delete(tableSet.rateLimitLeases)
          .where(
            and(
              eq(tableSet.rateLimitLeases.threadId, input.threadId),
              sql`${tableSet.rateLimitLeases.expiresAt} < ${nowIso}`
            )
          );

        const rows = (await txConn
          .select({ activeCount: tableSet.rateLimitLeases.activeCount })
          .from(tableSet.rateLimitLeases)
          .where(
            and(eq(tableSet.rateLimitLeases.threadId, input.threadId))
          )) as Array<{ activeCount: number }>;

        const current = rows.at(0)?.activeCount ?? 0;
        if (current >= input.limit) {
          return;
        }

        if (rows.length === 0) {
          await txConn.insert(tableSet.rateLimitLeases).values({
            activeCount: 1,
            expiresAt: expiryIso,
            threadId: input.threadId,
            updatedAt: nowIso,
          });
        } else {
          await txConn
            .update(tableSet.rateLimitLeases)
            .set({
              activeCount: current + 1,
              expiresAt: expiryIso,
              updatedAt: nowIso,
            })
            .where(and(eq(tableSet.rateLimitLeases.threadId, input.threadId)));
        }

        acquired = true;
      });

      return acquired;
    },

    async countViolations(input) {
      const rows = (await conn
        .select({ count: sql<number>`count(*)` })
        .from(tableSet.rateLimitViolations)
        .where(
          and(
            eq(tableSet.rateLimitViolations.userId, input.userId),
            gte(
              tableSet.rateLimitViolations.createdAt,
              input.since.toISOString()
            )
          )
        )) as Array<{ count: number }>;

      return rows.at(0)?.count ?? 0;
    },

    getTokenUsage(input) {
      if (!input.userId) {
        return Promise.resolve(0);
      }
      return this.getTokenUsageFromBuckets({
        granularity: "hour",
        since: input.since,
        userId: input.userId,
      });
    },

    async getTokenUsageFromBuckets(input) {
      await syncTokenBuckets();
      const rows = (await conn
        .select({
          tokens: sql<number>`cast(coalesce(sum(${tableSet.rateLimitTokenUsage.tokens}), 0) as integer)`,
        })
        .from(tableSet.rateLimitTokenUsage)
        .where(
          and(
            eq(tableSet.rateLimitTokenUsage.userId, input.userId),
            eq(
              tableSet.rateLimitTokenUsage.bucketGranularity,
              input.granularity
            ),
            gte(
              tableSet.rateLimitTokenUsage.bucketStart,
              input.since.toISOString()
            )
          )
        )) as Array<{ tokens: number }>;

      return rows.at(0)?.tokens ?? 0;
    },

    async getWindowCount(input) {
      const since = new Date(
        input.now.getTime() - input.windowMs
      ).toISOString();
      const rows = (await conn
        .select({ count: sql<number>`count(*)` })
        .from(tableSet.rateLimitWindows)
        .where(
          and(
            eq(tableSet.rateLimitWindows.rule, input.rule),
            eq(tableSet.rateLimitWindows.bucketType, "window"),
            eq(tableSet.rateLimitWindows.bucketValue, input.key),
            gte(tableSet.rateLimitWindows.updatedAt, since)
          )
        )) as Array<{ count: number }>;

      return rows.at(0)?.count ?? 0;
    },

    async getWindowCountAndIncrement(input) {
      const nowIso = input.now.toISOString();
      await conn.insert(tableSet.rateLimitWindows).values({
        bucketStart: nowIso,
        bucketType: "window",
        bucketValue: input.key,
        count: 1,
        rule: input.rule,
        updatedAt: nowIso,
      });

      return this.getWindowCount(input);
    },

    async getCooldown(input) {
      const rows = (await conn
        .select({ expiresAt: tableSet.rateLimitCooldowns.expiresAt })
        .from(tableSet.rateLimitCooldowns)
        .where(
          and(eq(tableSet.rateLimitCooldowns.userId, input.userId))
        )) as Array<{ expiresAt: string }>;

      const value = rows.at(0)?.expiresAt;
      if (!value) {
        return null;
      }

      const expiresAt = new Date(value);
      if (expiresAt <= input.now) {
        await conn
          .delete(tableSet.rateLimitCooldowns)
          .where(and(eq(tableSet.rateLimitCooldowns.userId, input.userId)));
        return null;
      }

      return expiresAt;
    },

    async releaseLease(input) {
      const rows = (await conn
        .select({ activeCount: tableSet.rateLimitLeases.activeCount })
        .from(tableSet.rateLimitLeases)
        .where(
          and(eq(tableSet.rateLimitLeases.threadId, input.threadId))
        )) as Array<{ activeCount: number }>;

      const current = rows.at(0)?.activeCount ?? 0;
      if (current <= 1) {
        await conn
          .delete(tableSet.rateLimitLeases)
          .where(and(eq(tableSet.rateLimitLeases.threadId, input.threadId)));
        return;
      }

      await conn
        .update(tableSet.rateLimitLeases)
        .set({
          activeCount: current - 1,
          updatedAt: new Date().toISOString(),
        })
        .where(and(eq(tableSet.rateLimitLeases.threadId, input.threadId)));
    },

    async setCooldown(input) {
      await conn
        .delete(tableSet.rateLimitCooldowns)
        .where(and(eq(tableSet.rateLimitCooldowns.userId, input.userId)));

      await conn.insert(tableSet.rateLimitCooldowns).values({
        expiresAt: input.expiresAt.toISOString(),
        updatedAt: new Date().toISOString(),
        userId: input.userId,
      });
    },

    async storeViolation(input) {
      await conn.insert(tableSet.rateLimitViolations).values({
        createdAt: input.now.toISOString(),
        userId: input.userId,
      });
    },
  };
};
