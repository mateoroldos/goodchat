import { queryOptions } from "@tanstack/svelte-query";
import { fetchPlatformStatus } from "./platforms.api";

export const platformsQueries = {
  status: (platformId: string) =>
    queryOptions({
      queryKey: ["platforms", platformId, "status"] as const,
      queryFn: () => fetchPlatformStatus(platformId),
    }),
};
