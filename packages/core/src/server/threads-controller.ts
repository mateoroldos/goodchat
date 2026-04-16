import type { Database } from "@goodchat/contracts/database/interface";
import { Elysia, t } from "elysia";

const DEFAULT_THREAD_LIMIT = 50;

const threadQueryModel = t.Object({
  limit: t.Numeric({ minimum: 0, maximum: 200, default: DEFAULT_THREAD_LIMIT }),
});

const createRequestId = (): string => crypto.randomUUID();

const logApiError = (requestId: string, error: Error): void => {
  console.error(`[${requestId}]`, error);
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
      try {
        return await database.threads.list({
          botId,
          limit: query.limit,
          sort: "desc",
        });
      } catch (error) {
        const requestId = createRequestId();
        logApiError(
          requestId,
          error instanceof Error
            ? error
            : new Error("Unknown thread list error")
        );
        return status(500, {
          code: "THREADS_UNKNOWN",
          message: "Unexpected error while loading threads.",
          requestId,
        });
      }
    },
    {
      query: threadQueryModel,
    }
  );
