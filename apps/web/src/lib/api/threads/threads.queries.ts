import { queryOptions } from "@tanstack/svelte-query";
import { fetchThreads } from "./threads.api";

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
};
