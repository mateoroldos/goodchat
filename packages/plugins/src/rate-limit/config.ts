import { z } from "zod";
import type { RateLimitRepository } from "./repository/types";

const WINDOW_BASE_UNIT_MS = {
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  m: 60 * 1000,
  s: 1000,
} as const;

const WINDOW_REGEX = /^(\d+)\/(?:(\d+))?([smhd])$/;
const COOLDOWN_REGEX = /^(\d+)\/(?:(\d+))?([smhd])\s*->\s*(\d+)([smhd])$/;

export interface ParsedWindow {
  count: number;
  raw: string;
  windowMs: number;
}

export interface ParsedCooldown {
  durationMs: number;
  raw: string;
  threshold: number;
  thresholdWindowMs: number;
}

export interface RateLimitConfigInput {
  cooldown?: string;
  exemptUserIds?: string[];
  maxConcurrentPerThread?: number;
  message?: string;
  messagesPerBot?: string;
  messagesPerThread?: string;
  messagesPerUser?: string;
  mode?: "enforce" | "monitor";
  repository?: RateLimitRepository;
  tokensPerDay?: number;
  tokensPerHour?: number;
  tokensPerMonth?: number;
}

export interface ParsedRateLimitConfig {
  cooldown?: ParsedCooldown;
  exemptUserIds: string[];
  maxConcurrentPerThread?: number;
  message: string;
  messagesPerBot?: ParsedWindow;
  messagesPerThread?: ParsedWindow;
  messagesPerUser?: ParsedWindow;
  mode: "enforce" | "monitor";
  repository: RateLimitRepository;
  tokensPerDay?: number;
  tokensPerHour?: number;
  tokensPerMonth?: number;
}

export type RateLimitConfigInputWithRepository = RateLimitConfigInput & {
  repository: RateLimitRepository;
};

type UnknownFn = (...args: unknown[]) => unknown;

const functionSchema = (methodName: string) =>
  z.custom<UnknownFn>((value) => typeof value === "function", {
    message: `rateLimit repository.${methodName} must be a function`,
  });

const repositorySchema = z
  .object({
    acquireLease: functionSchema("acquireLease"),
    countViolations: functionSchema("countViolations"),
    getCooldown: functionSchema("getCooldown"),
    getTokenUsage: functionSchema("getTokenUsage"),
    getTokenUsageFromBuckets: functionSchema("getTokenUsageFromBuckets"),
    getWindowCount: functionSchema("getWindowCount"),
    getWindowCountAndIncrement: functionSchema("getWindowCountAndIncrement"),
    releaseLease: functionSchema("releaseLease"),
    setCooldown: functionSchema("setCooldown"),
    storeViolation: functionSchema("storeViolation"),
  })
  .strict() as z.ZodType<RateLimitRepository>;

const optionalPositiveInt = z.number().int().positive().optional();

const rateLimitConfigSchema = z.object({
  cooldown: z.string().optional(),
  exemptUserIds: z
    .array(z.string().min(1, "Exempt user id is required"))
    .default([]),
  maxConcurrentPerThread: optionalPositiveInt,
  message: z
    .string()
    .default("Rate limit reached. Try again in {{retryAfter}}."),
  messagesPerBot: z.string().optional(),
  messagesPerThread: z.string().optional(),
  messagesPerUser: z.string().optional(),
  mode: z.enum(["enforce", "monitor"]).default("enforce"),
  repository: repositorySchema.optional(),
  tokensPerDay: optionalPositiveInt,
  tokensPerHour: optionalPositiveInt,
  tokensPerMonth: optionalPositiveInt,
});

const parseDurationMs = (
  unitCount: number,
  unitBase: keyof typeof WINDOW_BASE_UNIT_MS
) => {
  const baseMs = WINDOW_BASE_UNIT_MS[unitBase];
  return unitCount * baseMs;
};

export const parseWindow = (value: string): ParsedWindow => {
  const match = WINDOW_REGEX.exec(value.trim());
  if (!match) {
    throw new Error(
      `Invalid window string "${value}". Expected format "count/window" like "20/5m" or "60/h".`
    );
  }

  const [, countRaw, unitCountRaw, unitBaseRaw] = match;
  if (!(countRaw && unitBaseRaw)) {
    throw new Error(`Invalid window string "${value}".`);
  }
  const count = Number.parseInt(countRaw, 10);
  const unitCount = unitCountRaw ? Number.parseInt(unitCountRaw, 10) : 1;
  const unitBase = unitBaseRaw as keyof typeof WINDOW_BASE_UNIT_MS;

  if (count <= 0 || unitCount <= 0) {
    throw new Error(`Window values must be positive integers: "${value}".`);
  }

  return {
    count,
    raw: value,
    windowMs: parseDurationMs(unitCount, unitBase),
  };
};

export const parseCooldown = (value: string): ParsedCooldown => {
  const match = COOLDOWN_REGEX.exec(value.trim());
  if (!match) {
    throw new Error(
      `Invalid cooldown string "${value}". Expected format "N/window -> duration" like "3/10m -> 15m".`
    );
  }

  const [
    ,
    thresholdRaw,
    windowCountRaw,
    windowUnitRaw,
    durationCountRaw,
    durationUnitRaw,
  ] = match;

  if (!(thresholdRaw && windowUnitRaw && durationCountRaw && durationUnitRaw)) {
    throw new Error(`Invalid cooldown string "${value}".`);
  }

  const threshold = Number.parseInt(thresholdRaw, 10);
  const windowCount = windowCountRaw ? Number.parseInt(windowCountRaw, 10) : 1;
  const durationCount = Number.parseInt(durationCountRaw, 10);
  const windowUnit = windowUnitRaw as keyof typeof WINDOW_BASE_UNIT_MS;
  const durationUnit = durationUnitRaw as keyof typeof WINDOW_BASE_UNIT_MS;

  if (threshold <= 0 || windowCount <= 0 || durationCount <= 0) {
    throw new Error(`Cooldown values must be positive integers: "${value}".`);
  }

  return {
    durationMs: parseDurationMs(durationCount, durationUnit),
    raw: value,
    threshold,
    thresholdWindowMs: parseDurationMs(windowCount, windowUnit),
  };
};

export const parseRateLimitConfig = (
  input: RateLimitConfigInputWithRepository
): ParsedRateLimitConfig => {
  const parsed = rateLimitConfigSchema.parse(input);

  return {
    ...parsed,
    cooldown: parsed.cooldown ? parseCooldown(parsed.cooldown) : undefined,
    messagesPerBot: parsed.messagesPerBot
      ? parseWindow(parsed.messagesPerBot)
      : undefined,
    messagesPerThread: parsed.messagesPerThread
      ? parseWindow(parsed.messagesPerThread)
      : undefined,
    messagesPerUser: parsed.messagesPerUser
      ? parseWindow(parsed.messagesPerUser)
      : undefined,
    repository: input.repository,
  };
};
