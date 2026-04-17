import type { Database } from "@goodchat/contracts/database/interface";
import { Elysia, t } from "elysia";
import type { LoggerService } from "../logger/interface";

const DEFAULT_THREAD_LIMIT = 50;

const threadQueryModel = t.Object({
  limit: t.Numeric({ minimum: 0, maximum: 200, default: DEFAULT_THREAD_LIMIT }),
});

const threadParamsModel = t.Object({
  threadId: t.String(),
});

const createRequestId = (): string => crypto.randomUUID();

interface ThreadsControllerOptions {
  botId: string;
  database: Database;
  logger: LoggerService;
}

export const threadsController = ({
  database,
  botId,
  logger,
}: ThreadsControllerOptions) =>
  new Elysia({ prefix: "/threads" })
    .get(
      "/",
      async ({ query, status }) => {
        const log = logger.request();
        log.set({
          query: { limit: query.limit },
        });

        try {
          const threads = await database.threads.list({
            botId,
            limit: query.limit,
            sort: "desc",
          });

          log.set({
            outcome: { status: "success" },
            threads: { count: threads.length },
          });

          return threads;
        } catch (error) {
          const requestId = createRequestId();
          const unknownError =
            error instanceof Error
              ? error
              : new Error("Unknown thread list error");

          log.error("Failed to list threads", {
            error: {
              code: "THREADS_UNKNOWN",
              message: unknownError.message,
              type: unknownError.name,
              why: "Database query for thread list failed.",
              fix: "Verify database connectivity and that thread tables are migrated.",
            },
            requestId,
          });

          return status(500, {
            code: "THREADS_UNKNOWN",
            message: "Unexpected error while loading threads.",
            why: "Thread listing failed due to an internal database error.",
            fix: "Retry the request and inspect logs with the requestId.",
            requestId,
          });
        }
      },
      {
        query: threadQueryModel,
      }
    )
    .get(
      "/:threadId/messages",
      async ({ params, query, status }) => {
        const log = logger.request();
        log.set({
          query: { limit: query.limit },
          thread: { id: params.threadId },
        });

        try {
          const messages = await database.messages.listByThread({
            threadId: params.threadId,
            limit: query.limit,
            sort: "asc",
          });

          log.set({
            outcome: { status: "success" },
            messages: { count: messages.length },
          });

          return messages;
        } catch (error) {
          const requestId = createRequestId();
          const unknownError =
            error instanceof Error
              ? error
              : new Error("Unknown thread message list error");

          log.error("Failed to list thread messages", {
            error: {
              code: "THREAD_MESSAGES_UNKNOWN",
              message: unknownError.message,
              type: unknownError.name,
              why: "Database query for thread message list failed.",
              fix: "Verify database connectivity and that message tables are migrated.",
            },
            requestId,
          });

          return status(500, {
            code: "THREAD_MESSAGES_UNKNOWN",
            message: "Unexpected error while loading thread messages.",
            why: "Thread message listing failed due to an internal database error.",
            fix: "Retry the request and inspect logs with the requestId.",
            requestId,
          });
        }
      },
      {
        params: threadParamsModel,
        query: threadQueryModel,
      }
    )
    .get(
      "/:threadId/runs",
      async ({ params, query, status }) => {
        const log = logger.request();
        log.set({
          query: { limit: query.limit },
          thread: { id: params.threadId },
        });

        try {
          const runs = await database.aiRuns.listByThread({
            threadId: params.threadId,
            limit: query.limit,
            sort: "desc",
          });

          const runsWithToolCalls = await Promise.all(
            runs.map(async (run) => {
              const toolCalls = await database.aiRunToolCalls.listByRun({
                aiRunId: run.id,
                sort: "asc",
              });
              return {
                ...run,
                toolCalls,
              };
            })
          );

          log.set({
            outcome: { status: "success" },
            runs: { count: runsWithToolCalls.length },
          });

          return runsWithToolCalls;
        } catch (error) {
          const requestId = createRequestId();
          const unknownError =
            error instanceof Error
              ? error
              : new Error("Unknown thread run list error");

          log.error("Failed to list thread runs", {
            error: {
              code: "THREAD_RUNS_UNKNOWN",
              message: unknownError.message,
              type: unknownError.name,
              why: "Database query for thread AI run list failed.",
              fix: "Verify database connectivity and that AI run tables are migrated.",
            },
            requestId,
          });

          return status(500, {
            code: "THREAD_RUNS_UNKNOWN",
            message: "Unexpected error while loading thread runs.",
            why: "Thread AI run listing failed due to an internal database error.",
            fix: "Retry the request and inspect logs with the requestId.",
            requestId,
          });
        }
      },
      {
        params: threadParamsModel,
        query: threadQueryModel,
      }
    );
