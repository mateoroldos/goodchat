import type { MessageStoreService } from "@goodchat/core/message-store/message-store.service.interface";

const DEFAULT_THREAD_LIMIT = 50;

export const getThreads = (
  limit: number | undefined,
  services: {
    messageStore: MessageStoreService;
  }
) => {
  const { messageStore } = services;

  const resolvedLimit = Math.trunc(limit ?? DEFAULT_THREAD_LIMIT);

  return messageStore.listThreads(resolvedLimit);
};
