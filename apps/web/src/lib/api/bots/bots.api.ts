import { eden } from "$lib/eden-client";

export const fetchBot = async () => {
  const { data, error } = await eden.api.bot.get();
  if (error) {
    throw new Error("Failed to fetch bot");
  }
  return data;
};
