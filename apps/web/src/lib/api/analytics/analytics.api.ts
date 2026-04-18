import { eden } from "$lib/eden-client";

export const fetchWeeklyStats = async () => {
  const { data, error } = await eden.api.threads.analytics.get();
  if (error || !data) {
    throw new Error("Failed to fetch analytics");
  }

  return data;
};
