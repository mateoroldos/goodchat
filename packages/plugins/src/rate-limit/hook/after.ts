import type { GoodchatHooks } from "@goodchat/contracts/plugins/types";
import { emitRateLimitEvent } from "../events";
import type { BuildHookInput } from "./types";

export const buildAfterHook = ({
  config,
}: BuildHookInput): NonNullable<GoodchatHooks["afterMessage"]> => {
  return async (context) => {
    if (typeof config.maxConcurrentPerThread !== "number") {
      return;
    }

    await config.repository.releaseLease({
      threadId: context.threadId,
    });

    emitRateLimitEvent(context.log, {
      current: null,
      event: "rate_limit.lease_release",
      limit: null,
      mode: config.mode,
      platform: context.platform,
      rule: "maxConcurrentPerThread",
      threadId: context.threadId,
      userId: context.userId,
    });
  };
};
