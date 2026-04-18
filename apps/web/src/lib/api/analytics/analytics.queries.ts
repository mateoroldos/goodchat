import { queryOptions } from "@tanstack/svelte-query";
import { fetchWeeklyStats } from "./analytics.api";

export const analyticsQueries = {
  weekly: () =>
    queryOptions({
      queryKey: ["analytics", "weekly"] as const,
      queryFn: fetchWeeklyStats,
    }),
};
