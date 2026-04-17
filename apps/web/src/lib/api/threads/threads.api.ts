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

export const fetchThreadMessages = async (threadId: string, limit = 200) => {
  const { data, error } = await eden.api.threads({ threadId }).messages.get({
    query: { limit },
  });
  if (error) {
    throw new Error("Failed to fetch messages");
  }
  if (!Array.isArray(data)) {
    throw new Error("Failed to fetch messages");
  }
  return data;
};

export const fetchThreadRuns = async (threadId: string, limit = 200) => {
  const { data, error } = await eden.api.threads({ threadId }).runs.get({
    query: { limit },
  });
  if (error) {
    throw new Error("Failed to fetch runs");
  }
  if (!Array.isArray(data)) {
    throw new Error("Failed to fetch runs");
  }
  return data;
};
