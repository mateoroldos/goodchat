import { Elysia, t } from "elysia";
import type { MessageStoreService } from "../message-store/interface";

const DEFAULT_THREAD_LIMIT = 50;

const threadQueryModel = t.Object({
  limit: t.Numeric({ minimum: 0, maximum: 200, default: DEFAULT_THREAD_LIMIT }),
});

const createRequestId = (): string => crypto.randomUUID();

const logApiError = (requestId: string, error: Error): void => {
  console.error(`[${requestId}]`, error);
};

export const threadsController = (messageStore: MessageStoreService) =>
  new Elysia({ prefix: "/threads" }).get(
    "/",
    ({ query, status }) => {
      const result = messageStore.listThreads(query.limit);

      if (result.isErr()) {
        const error = result.error;
        const requestId = createRequestId();

        logApiError(requestId, error);

        switch (error.code) {
          case "THREAD_LIMIT_INVALID":
            return status(422, {
              code: error.code,
              message: "Thread limit must be a non-negative number.",
              requestId,
            });

          default:
            return status(500, {
              code: "THREADS_UNKNOWN",
              message: "Unexpected error while loading threads.",
              requestId,
            });
        }
      }

      return result.value;
    },
    {
      query: threadQueryModel,
    }
  );
