import { eden } from "$lib/eden-client";

export const fetchPlatformStatus = async (platformId: string) => {
  const { data, error } = await eden.api.bot
    .platforms({ name: platformId })
    .status.get();
  if (error) {
    throw new Error(`Failed to fetch status for ${platformId}`);
  }
  return data;
};
