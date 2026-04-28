import type {
  AiRun,
  AiRunCreate,
  AiRunUpdate,
} from "@goodchat/contracts/database/ai-run";
import type {
  AiRunToolCall,
  AiRunToolCallCreate,
  AiRunToolCallUpdate,
} from "@goodchat/contracts/database/ai-run-tool-call";
import type { Database } from "@goodchat/contracts/database/interface";
import type {
  Message,
  MessageCreate,
  MessageUpdate,
} from "@goodchat/contracts/database/message";
import type {
  Thread,
  ThreadCreate,
  ThreadUpdate,
} from "@goodchat/contracts/database/thread";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { mysqlSchema } from "../schema/mysql";
import type { MysqlDatabase } from "./mysql";
import { buildCursorFilter, DEFAULT_LIST_LIMIT } from "./repository-shared";

type Repositories = Pick<
  Database,
  "aiRuns" | "aiRunToolCalls" | "analytics" | "messages" | "threads"
>;

export const createMysqlRepositories = (db: MysqlDatabase): Repositories => {
  const { aiRunToolCalls, aiRuns, messages, threads } = mysqlSchema;

  return {
    analytics: {
      async weeklyStats() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 6);
        const cutoffStr = cutoff.toISOString().slice(0, 10);

        const threadsByDay = await db
          .select({
            date: sql<string>`DATE_FORMAT(${threads.createdAt}, '%Y-%m-%d')`,
            count: sql<number>`cast(count(*) as signed)`,
          })
          .from(threads)
          .where(gte(threads.createdAt, cutoffStr))
          .groupBy(sql`DATE(${threads.createdAt})`)
          .orderBy(sql`DATE(${threads.createdAt})`);

        const tokensByDay = await db
          .select({
            date: sql<string>`DATE_FORMAT(${aiRuns.createdAt}, '%Y-%m-%d')`,
            tokens: sql<number>`cast(coalesce(sum(${aiRuns.totalTokens}), 0) as signed)`,
          })
          .from(aiRuns)
          .innerJoin(threads, eq(aiRuns.threadId, threads.id))
          .where(gte(aiRuns.createdAt, cutoffStr))
          .groupBy(sql`DATE(${aiRuns.createdAt})`)
          .orderBy(sql`DATE(${aiRuns.createdAt})`);

        return { threadsByDay, tokensByDay };
      },
    },
    aiRuns: {
      async create(input: AiRunCreate) {
        await db.insert(aiRuns).values(input);
        return input as AiRun;
      },
      async getById(id: string) {
        const rows = await db.select().from(aiRuns).where(eq(aiRuns.id, id));
        const row = rows[0];
        return row ? (row as AiRun) : null;
      },
      async listByThread(
        input: Parameters<Database["aiRuns"]["listByThread"]>[0]
      ) {
        const sortDirection = input.sort ?? "desc";
        const limit = input.limit ?? DEFAULT_LIST_LIMIT;
        const baseFilter = eq(aiRuns.threadId, input.threadId);
        const cursorFilter = input.cursor
          ? buildCursorFilter(
              sortDirection,
              aiRuns.createdAt,
              aiRuns.id,
              input.cursor.createdAt,
              input.cursor.id
            )
          : undefined;
        const whereClause = cursorFilter
          ? and(baseFilter, cursorFilter)
          : baseFilter;
        const orderBy =
          sortDirection === "asc"
            ? [asc(aiRuns.createdAt), asc(aiRuns.id)]
            : [desc(aiRuns.createdAt), desc(aiRuns.id)];

        const rows = await db
          .select()
          .from(aiRuns)
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit);

        return rows.map((row: unknown) => row as AiRun);
      },
      async update(id: string, patch: AiRunUpdate) {
        await db.update(aiRuns).set(patch).where(eq(aiRuns.id, id));
        const rows = await db.select().from(aiRuns).where(eq(aiRuns.id, id));
        const updated = rows[0];
        if (!updated) {
          throw new Error(`AI run not found: ${id}`);
        }
        return updated as AiRun;
      },
      async delete(id: string) {
        await db.delete(aiRuns).where(eq(aiRuns.id, id));
      },
    },
    aiRunToolCalls: {
      async create(input: AiRunToolCallCreate) {
        await db.insert(aiRunToolCalls).values(input);
        return input as AiRunToolCall;
      },
      async getById(id: string) {
        const rows = await db
          .select()
          .from(aiRunToolCalls)
          .where(eq(aiRunToolCalls.id, id));
        const row = rows[0];
        return row ? (row as AiRunToolCall) : null;
      },
      async listByRun(
        input: Parameters<Database["aiRunToolCalls"]["listByRun"]>[0]
      ) {
        const sortDirection = input.sort ?? "desc";
        const limit = input.limit ?? DEFAULT_LIST_LIMIT;
        const baseFilter = eq(aiRunToolCalls.aiRunId, input.aiRunId);
        const cursorFilter = input.cursor
          ? buildCursorFilter(
              sortDirection,
              aiRunToolCalls.createdAt,
              aiRunToolCalls.id,
              input.cursor.createdAt,
              input.cursor.id
            )
          : undefined;
        const whereClause = cursorFilter
          ? and(baseFilter, cursorFilter)
          : baseFilter;
        const orderBy =
          sortDirection === "asc"
            ? [asc(aiRunToolCalls.createdAt), asc(aiRunToolCalls.id)]
            : [desc(aiRunToolCalls.createdAt), desc(aiRunToolCalls.id)];

        const rows = await db
          .select()
          .from(aiRunToolCalls)
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit);

        return rows.map((row: unknown) => row as AiRunToolCall);
      },
      async update(id: string, patch: AiRunToolCallUpdate) {
        await db
          .update(aiRunToolCalls)
          .set(patch)
          .where(eq(aiRunToolCalls.id, id));
        const rows = await db
          .select()
          .from(aiRunToolCalls)
          .where(eq(aiRunToolCalls.id, id));
        const updated = rows[0];
        if (!updated) {
          throw new Error(`AI run tool call not found: ${id}`);
        }
        return updated as AiRunToolCall;
      },
      async delete(id: string) {
        await db.delete(aiRunToolCalls).where(eq(aiRunToolCalls.id, id));
      },
    },
    threads: {
      async create(input: ThreadCreate) {
        await db.insert(threads).values(input);
        return input as Thread;
      },
      async getById(id: string) {
        const rows = await db.select().from(threads).where(eq(threads.id, id));
        const row = rows[0];
        return row ? (row as Thread) : null;
      },
      async list(input: Parameters<Database["threads"]["list"]>[0]) {
        const sortDirection = input.sort ?? "desc";
        const limit = input.limit ?? DEFAULT_LIST_LIMIT;
        const cursorFilter = input.cursor
          ? buildCursorFilter(
              sortDirection,
              threads.createdAt,
              threads.id,
              input.cursor.createdAt,
              input.cursor.id
            )
          : undefined;
        const orderBy =
          sortDirection === "asc"
            ? [asc(threads.createdAt), asc(threads.id)]
            : [desc(threads.createdAt), desc(threads.id)];

        const query = db.select().from(threads);
        const rows = await (cursorFilter ? query.where(cursorFilter) : query)
          .orderBy(...orderBy)
          .limit(limit);

        return rows.map((row: unknown) => row as Thread);
      },
      async update(id: string, patch: ThreadUpdate) {
        await db.update(threads).set(patch).where(eq(threads.id, id));
        const rows = await db.select().from(threads).where(eq(threads.id, id));
        const updated = rows[0];
        if (!updated) {
          throw new Error(`Thread not found: ${id}`);
        }
        return updated as Thread;
      },
      async delete(id: string) {
        await db.delete(threads).where(eq(threads.id, id));
      },
    },
    messages: {
      async create(input: MessageCreate) {
        await db.insert(messages).values(input);
        return input as Message;
      },
      async getById(id: string) {
        const rows = await db
          .select()
          .from(messages)
          .where(eq(messages.id, id));
        const row = rows[0];
        return row ? (row as Message) : null;
      },
      async listByThread(
        input: Parameters<Database["messages"]["listByThread"]>[0]
      ) {
        const sortDirection = input.sort ?? "desc";
        const limit = input.limit ?? DEFAULT_LIST_LIMIT;
        const baseFilter = eq(messages.threadId, input.threadId);
        const cursorFilter = input.cursor
          ? buildCursorFilter(
              sortDirection,
              messages.createdAt,
              messages.id,
              input.cursor.createdAt,
              input.cursor.id
            )
          : undefined;
        const whereClause = cursorFilter
          ? and(baseFilter, cursorFilter)
          : baseFilter;
        const orderBy =
          sortDirection === "asc"
            ? [asc(messages.createdAt), asc(messages.id)]
            : [desc(messages.createdAt), desc(messages.id)];

        const rows = await db
          .select()
          .from(messages)
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit);

        return rows.map((row: unknown) => row as Message);
      },
      async update(id: string, patch: MessageUpdate) {
        await db.update(messages).set(patch).where(eq(messages.id, id));
        const rows = await db
          .select()
          .from(messages)
          .where(eq(messages.id, id));
        const updated = rows[0];
        if (!updated) {
          throw new Error(`Message not found: ${id}`);
        }
        return updated as Message;
      },
      async delete(id: string) {
        await db.delete(messages).where(eq(messages.id, id));
      },
    },
  };
};
