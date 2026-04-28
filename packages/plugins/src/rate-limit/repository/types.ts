export type RateLimitWindowRule =
  | "messagesPerBot"
  | "messagesPerThread"
  | "messagesPerUser";

export interface WindowInput {
  key: string;
  now: Date;
  rule: RateLimitWindowRule;
  windowMs: number;
}

export interface TokenUsageInput {
  since: Date;
  userId?: string;
}

export type TokenBucketGranularity = "hour" | "day" | "month";

export interface ViolationInput {
  now: Date;
  userId: string;
}

export interface LeaseInput {
  limit: number;
  now: Date;
  threadId: string;
  ttlMs: number;
}

export interface RateLimitRepository {
  acquireLease(input: LeaseInput): Promise<boolean>;
  countViolations(input: { since: Date; userId: string }): Promise<number>;
  getCooldown(input: { now: Date; userId: string }): Promise<Date | null>;
  getTokenUsage(input: TokenUsageInput): Promise<number>;
  getTokenUsageFromBuckets(input: {
    granularity: TokenBucketGranularity;
    since: Date;
    userId: string;
  }): Promise<number>;
  getWindowCount(input: WindowInput): Promise<number>;
  getWindowCountAndIncrement(input: WindowInput): Promise<number>;
  releaseLease(input: { threadId: string }): Promise<void>;
  setCooldown(input: { expiresAt: Date; userId: string }): Promise<void>;
  storeViolation(input: ViolationInput): Promise<void>;
}
