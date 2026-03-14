import type { MessageStoreService } from "@goodchat/core/message-store/message-store.service.interface";
import { Elysia } from "elysia";
import { createRequestId, logApiError } from "../../utils/errors";
import { threadQueryModel } from "./model";

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
