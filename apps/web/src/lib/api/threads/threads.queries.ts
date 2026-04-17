import { queryOptions } from "@tanstack/svelte-query";
import {
  fetchThreadMessages,
  fetchThreadRuns,
  fetchThreads,
} from "./threads.api";

interface ThreadsListParams {
  limit?: number;
}

export const threadsQueries = {
  all: () => ["threads"] as const,
  lists: () => [...threadsQueries.all(), "list"] as const,
  list: (params: ThreadsListParams = {}) =>
    queryOptions({
      queryKey: [...threadsQueries.lists(), params] as const,
      queryFn: () => fetchThreads(params.limit),
    }),
  messages: (threadId: string) =>
    queryOptions({
      queryKey: [...threadsQueries.all(), threadId, "messages"] as const,
      queryFn: () => fetchThreadMessages(threadId),
    }),
  runs: (threadId: string) =>
    queryOptions({
      queryKey: [...threadsQueries.all(), threadId, "runs"] as const,
      queryFn: () => fetchThreadRuns(threadId),
    }),
};
