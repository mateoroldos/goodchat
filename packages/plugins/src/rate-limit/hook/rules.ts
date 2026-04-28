import type { ParsedRateLimitConfig } from "../config";
import { DAY_MS, HOUR_MS, MONTH_30_DAY_MS } from "./constants";
import { resolveKey } from "./keys";
import type { BeforeContext } from "./types";

export type WindowRepositoryRule =
  | "messagesPerBot"
  | "messagesPerThread"
  | "messagesPerUser";

export const getWindowRules = (
  config: ParsedRateLimitConfig,
  context: BeforeContext
): Array<{
  key: string;
  parsed: ParsedRateLimitConfig["messagesPerBot"];
  repositoryRule: WindowRepositoryRule;
}> => {
  return [
    {
      key: resolveKey("thread", context),
      parsed: config.messagesPerThread,
      repositoryRule: "messagesPerThread",
    },
    {
      key: resolveKey("user", context),
      parsed: config.messagesPerUser,
      repositoryRule: "messagesPerUser",
    },
    {
      key: resolveKey("bot", context),
      parsed: config.messagesPerBot,
      repositoryRule: "messagesPerBot",
    },
  ];
};

export const getTokenRules = (config: ParsedRateLimitConfig) => {
  return [
    {
      granularity: "hour" as const,
      limit: config.tokensPerHour,
      rule: "tokensPerHour" as const,
      windowMs: HOUR_MS,
    },
    {
      granularity: "day" as const,
      limit: config.tokensPerDay,
      rule: "tokensPerDay" as const,
      windowMs: DAY_MS,
    },
    {
      granularity: "month" as const,
      limit: config.tokensPerMonth,
      rule: "tokensPerMonth" as const,
      windowMs: MONTH_30_DAY_MS,
    },
  ];
};
