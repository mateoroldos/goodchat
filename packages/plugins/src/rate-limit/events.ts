import type { Platform } from "@goodchat/contracts/config/types";
import type { Logger } from "@goodchat/contracts/plugins/types";

export type RateLimitRule =
  | "cooldown"
  | "maxConcurrentPerThread"
  | "messagesPerBot"
  | "messagesPerThread"
  | "messagesPerUser"
  | "tokensPerDay"
  | "tokensPerHour"
  | "tokensPerMonth";

export type RateLimitMode = "enforce" | "monitor";

export interface RateLimitEvent {
  current: number | null;
  event:
    | "rate_limit.allow"
    | "rate_limit.cooldown"
    | "rate_limit.deny"
    | "rate_limit.lease_release";
  limit: number | null;
  mode: RateLimitMode;
  platform: Platform;
  retryAfterMs?: number;
  rule: RateLimitRule | null;
  threadId: string;
  userId: string;
}

export const emitRateLimitEvent = (
  log: Logger,
  event: RateLimitEvent
): void => {
  log.set(event as unknown as Record<string, unknown>);
};
