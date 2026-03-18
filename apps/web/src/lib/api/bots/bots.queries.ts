import { queryOptions } from "@tanstack/svelte-query";
import { fetchBot } from "./bots.api";

export const botQueries = {
  all: () => ["bot"] as const,
  detail: () =>
    queryOptions({
      queryKey: [...botQueries.all(), "detail"] as const,
      queryFn: fetchBot,
    }),
};
