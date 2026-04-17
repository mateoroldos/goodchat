import type { Database } from "@goodchat/contracts/database/interface";
import { Elysia, t } from "elysia";
import { useLogger } from "evlog/elysia";
import { NOOP_LOGGER } from "../logger/noop";

const DEFAULT_THREAD_LIMIT = 50;

const threadQueryModel = t.Object({
  limit: t.Numeric({ minimum: 0, maximum: 200, default: DEFAULT_THREAD_LIMIT }),
});

const createRequestId = (): string => crypto.randomUUID();

const getRequestLogger = () => {
  try {
    return useLogger();
  } catch {
    return NOOP_LOGGER;
  }
};

interface ThreadsControllerOptions {
  botId: string;
  database: Database;
}

export const threadsController = ({
  database,
  botId,
}: ThreadsControllerOptions) =>
  new Elysia({ prefix: "/threads" }).get(
    "/",
    async ({ query, status }) => {
      const log = getRequestLogger();
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
  );
