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
import { postgresSchema } from "@goodchat/templates/schema/postgres";
import type { AnyColumn } from "drizzle-orm";
import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import type { PostgresDatabase } from "./client";

const DEFAULT_LIST_LIMIT = 50;

const mapThread = (thread: Thread): Thread => thread;
const mapMessage = (message: Message): Message => message;
const mapAiRun = (aiRun: AiRun): AiRun => aiRun;
const mapAiRunToolCall = (toolCall: AiRunToolCall): AiRunToolCall => toolCall;

export const createPostgresRepositories = (
  database: PostgresDatabase
): Pick<Database, "aiRuns" | "aiRunToolCalls" | "messages" | "threads"> => {
  const { aiRunToolCalls, aiRuns, messages, threads } = postgresSchema;

  return {
    aiRuns: {
      async create(input: AiRunCreate) {
        await database.insert(aiRuns).values(input);
        return mapAiRun(input);
      },
      async getById(id: string) {
        const rows = await database
          .select()
          .from(aiRuns)
          .where(eq(aiRuns.id, id));
        const row = rows[0];
        return row ? mapAiRun(row as AiRun) : null;
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

        const rows = await database
          .select()
          .from(aiRuns)
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit);

        return rows.map((row) => mapAiRun(row as AiRun));
      },
      async update(id: string, patch: AiRunUpdate) {
        await database.update(aiRuns).set(patch).where(eq(aiRuns.id, id));
        const rows = await database
          .select()
          .from(aiRuns)
          .where(eq(aiRuns.id, id));
        const updated = rows[0];
        if (!updated) {
          throw new Error(`AI run not found: ${id}`);
        }
        return mapAiRun(updated as AiRun);
      },
      async delete(id: string) {
        await database.delete(aiRuns).where(eq(aiRuns.id, id));
      },
    },
    aiRunToolCalls: {
      async create(input: AiRunToolCallCreate) {
        await database.insert(aiRunToolCalls).values(input);
        return mapAiRunToolCall(input);
      },
      async getById(id: string) {
        const rows = await database
          .select()
          .from(aiRunToolCalls)
          .where(eq(aiRunToolCalls.id, id));
        const row = rows[0];
        return row ? mapAiRunToolCall(row as AiRunToolCall) : null;
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

        const rows = await database
          .select()
          .from(aiRunToolCalls)
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit);

        return rows.map((row) => mapAiRunToolCall(row as AiRunToolCall));
      },
      async update(id: string, patch: AiRunToolCallUpdate) {
        await database
          .update(aiRunToolCalls)
          .set(patch)
          .where(eq(aiRunToolCalls.id, id));
        const rows = await database
          .select()
          .from(aiRunToolCalls)
          .where(eq(aiRunToolCalls.id, id));
        const updated = rows[0];
        if (!updated) {
          throw new Error(`AI run tool call not found: ${id}`);
        }
        return mapAiRunToolCall(updated as AiRunToolCall);
      },
      async delete(id: string) {
        await database.delete(aiRunToolCalls).where(eq(aiRunToolCalls.id, id));
      },
    },
    threads: {
      async create(input: ThreadCreate) {
        await database.insert(threads).values(input);
        return mapThread(input);
      },
      async getById(id: string) {
        const rows = await database
          .select()
          .from(threads)
          .where(eq(threads.id, id));
        const row = rows[0];
        return row ? mapThread(row as Thread) : null;
      },
      async list(input: Parameters<Database["threads"]["list"]>[0]) {
        const sortDirection = input.sort ?? "desc";
        const limit = input.limit ?? DEFAULT_LIST_LIMIT;
        const baseFilter = eq(threads.botId, input.botId);
        const cursorFilter = input.cursor
          ? buildCursorFilter(
              sortDirection,
              threads.createdAt,
              threads.id,
              input.cursor.createdAt,
              input.cursor.id
            )
          : undefined;
        const whereClause = cursorFilter
          ? and(baseFilter, cursorFilter)
          : baseFilter;
        const orderBy =
          sortDirection === "asc"
            ? [asc(threads.createdAt), asc(threads.id)]
            : [desc(threads.createdAt), desc(threads.id)];

        const rows = await database
          .select()
          .from(threads)
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit);

        return rows.map((row) => mapThread(row as Thread));
      },
      async update(id: string, patch: ThreadUpdate) {
        await database.update(threads).set(patch).where(eq(threads.id, id));
        const rows = await database
          .select()
          .from(threads)
          .where(eq(threads.id, id));
        const updated = rows[0];
        if (!updated) {
          throw new Error(`Thread not found: ${id}`);
        }
        return mapThread(updated as Thread);
      },
      async delete(id: string) {
        await database.delete(threads).where(eq(threads.id, id));
      },
    },
    messages: {
      async create(input: MessageCreate) {
        await database.insert(messages).values(input);
        return mapMessage(input);
      },
      async getById(id: string) {
        const rows = await database
          .select()
          .from(messages)
          .where(eq(messages.id, id));
        const row = rows[0];
        return row ? mapMessage(row as Message) : null;
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

        const rows = await database
          .select()
          .from(messages)
          .where(whereClause)
          .orderBy(...orderBy)
          .limit(limit);

        return rows.map((row) => mapMessage(row as Message));
      },
      async update(id: string, patch: MessageUpdate) {
        await database.update(messages).set(patch).where(eq(messages.id, id));
        const rows = await database
          .select()
          .from(messages)
          .where(eq(messages.id, id));
        const updated = rows[0];
        if (!updated) {
          throw new Error(`Message not found: ${id}`);
        }
        return mapMessage(updated as Message);
      },
      async delete(id: string) {
        await database.delete(messages).where(eq(messages.id, id));
      },
    },
  };
};

const buildCursorFilter = (
  sort: "asc" | "desc",
  createdAtColumn: AnyColumn,
  idColumn: AnyColumn,
  createdAt: string,
  id: string
) => {
  if (sort === "asc") {
    return or(
      gt(createdAtColumn, createdAt),
      and(eq(createdAtColumn, createdAt), gt(idColumn, id))
    );
  }

  return or(
    lt(createdAtColumn, createdAt),
    and(eq(createdAtColumn, createdAt), lt(idColumn, id))
  );
};
