import { CHAT_PLATFORMS } from "@goodchat/contracts/config/models";
import type { Platform } from "@goodchat/contracts/config/types";

const PLATFORM_SET = new Set<string>(CHAT_PLATFORMS);

export const parseThreadPlatform = (threadId: string): Platform | null => {
  const [prefix] = threadId.split(":");
  if (!(prefix && PLATFORM_SET.has(prefix))) {
    return null;
  }

  return prefix as Platform;
};
