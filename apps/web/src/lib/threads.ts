import { eden } from "$lib/eden-client";

export const getThreads = async () => {
  const { data, error } = await eden.threads.get();

  if (error) {
    throw new Error(error.value?.message ?? "Failed to load threads");
  }

  if (!Array.isArray(data)) {
    throw new Error("Failed to load threads");
  }

  return data;
};
