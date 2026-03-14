import { eden } from "$lib/eden-client";

export const fetchBots = async () => {
  const { data, error } = await eden.api.bots.get();
  if (error) {
    throw new Error("Failed to fetch bots");
  }
  if (!Array.isArray(data)) {
    throw new Error("Failed to fetch bots");
  }
  return data;
};

export const fetchBot = async (id: string) => {
  const { data, error } = await eden.api.bots({ id }).get();
  if (error) {
    throw new Error("Failed to fetch bot");
  }
  return data;
};

export const fetchBotThreads = async (id: string, limit = 50) => {
  const { data, error } = await eden.api
    .bots({ id })
    .threads.get({ query: { limit } });
  if (error) {
    throw new Error("Failed to fetch bot threads");
  }
  return data ?? [];
};
