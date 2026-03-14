import { eden } from "$lib/eden-client";

export const fetchThreads = async (limit = 50) => {
  const { data, error } = await eden.api.threads.get({ query: { limit } });
  if (error) {
    throw new Error("Failed to fetch threads");
  }
  if (!Array.isArray(data)) {
    throw new Error("Failed to fetch threads");
  }
  return data;
};
