import type { ParsedRateLimitConfig } from "../config";
import { emitRateLimitEvent, type RateLimitRule } from "../events";
import { DEFAULT_RETRY_AFTER } from "./constants";
import type { BeforeContext } from "./types";

export interface DenyDetail {
  current: number | null;
  limit: number | null;
  retryAfterMs?: number;
  rule: RateLimitRule;
}

const formatRetryAfter = (retryAfterMs?: number): string => {
  if (typeof retryAfterMs !== "number" || retryAfterMs <= 0) {
    return DEFAULT_RETRY_AFTER;
  }

  if (retryAfterMs < 60_000) {
    return `${Math.ceil(retryAfterMs / 1000)}s`;
  }

  if (retryAfterMs < 60 * 60_000) {
    return `${Math.ceil(retryAfterMs / 60_000)}m`;
  }

  return `${Math.ceil(retryAfterMs / (60 * 60_000))}h`;
};

const renderUserMessage = (template: string, retryAfterMs?: number): string => {
  return template.replaceAll("{{retryAfter}}", formatRetryAfter(retryAfterMs));
};

const buildRateLimitDeny = (input: {
  retryAfterMs?: number;
  userMessage: string;
}) => {
  return {
    action: "deny" as const,
    reason: "rate_limited" as const,
    ...(typeof input.retryAfterMs === "number"
      ? { retryAfterMs: input.retryAfterMs }
      : {}),
    userMessage: input.userMessage,
  };
};

export const denyFromConfig = (
  context: BeforeContext,
  config: ParsedRateLimitConfig,
  detail: DenyDetail,
  retryAfterMs?: number
) => {
  emitRateLimitEvent(context.log, {
    current: detail.current,
    event: "rate_limit.deny",
    limit: detail.limit,
    mode: config.mode,
    platform: context.platform,
    ...(typeof detail.retryAfterMs === "number"
      ? { retryAfterMs: detail.retryAfterMs }
      : {}),
    rule: detail.rule,
    threadId: context.threadId,
    userId: context.userId,
  });

  if (config.mode === "monitor") {
    return { action: "continue" as const };
  }

  return buildRateLimitDeny({
    ...(typeof retryAfterMs === "number" ? { retryAfterMs } : {}),
    userMessage: renderUserMessage(config.message, retryAfterMs),
  });
};
