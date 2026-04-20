import { queryOptions } from "@tanstack/svelte-query";
import { fetchAuthStatus } from "./auth.api";

export const authQueries = {
  status: () =>
    queryOptions({
      queryKey: ["auth", "status"] as const,
      queryFn: fetchAuthStatus,
    }),
};
