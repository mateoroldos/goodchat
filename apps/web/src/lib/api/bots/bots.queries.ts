import { queryOptions } from "@tanstack/svelte-query";
import { fetchBot, fetchBots, fetchBotThreads } from "./bots.api";

interface BotThreadsParams {
  limit?: number;
}

export const botsQueries = {
  all: () => ["bots"] as const,
  lists: () => [...botsQueries.all(), "list"] as const,
  list: () =>
    queryOptions({
      queryKey: [...botsQueries.lists()] as const,
      queryFn: fetchBots,
    }),
  details: () => [...botsQueries.all(), "detail"] as const,
  detail: (id: string) =>
    queryOptions({
      queryKey: [...botsQueries.details(), id] as const,
      queryFn: () => fetchBot(id),
    }),
  threads: (id: string, params: BotThreadsParams = {}) =>
    queryOptions({
      queryKey: [...botsQueries.details(), id, "threads", params] as const,
      queryFn: () => fetchBotThreads(id, params.limit),
    }),
};
