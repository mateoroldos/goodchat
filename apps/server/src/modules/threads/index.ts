import type { MessageStoreService } from "@goodchat/core/message-store/message-store.service.interface";
import { matchError } from "better-result";
import { Elysia } from "elysia";
import { createRequestId, logApiError } from "../../utils/errors";
import { threadQueryModel } from "./model";
import { getThreads } from "./service";

export const threadsController = (messageStore: MessageStoreService) =>
  new Elysia({ prefix: "/threads" }).get(
    "/",
    ({ query, set }) => {
      const services = {
        messageStore,
      };

      const result = getThreads(query.limit, services);

      if (result.isErr()) {
        const error = result.error;
        const requestId = createRequestId();

        logApiError(requestId, error);

        return matchError(error, {
          ThreadLimitInvalidError: (taggedError) => {
            set.status = 400;
            return {
              code: taggedError.code,
              message: "Thread limit must be a non-negative number.",
              requestId,
            };
          },
        });
      }

      return result.value;
    },
    {
      query: threadQueryModel,
    }
  );
