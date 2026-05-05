import type {
  HookContext,
  HookDbCapability,
} from "@goodchat/contracts/hooks/types";
import { definePlugin } from "@goodchat/contracts/plugins/define";
import type { SchemaTableDeclaration } from "@goodchat/contracts/schema/types";
import { z } from "zod";

const subjects = ["user", "thread", "channel", "platform", "global"] as const;
const defaultMessage =
  "You've hit the rate limit. Please try again in {retryAfter}.";
const durationPattern = /^(?<amount>[1-9]\d*)(?<unit>[smhd])$/;

const durationUnitMs = {
  d: 86_400_000,
  h: 3_600_000,
  m: 60_000,
  s: 1000,
} as const;

const rateLimitRuleSchema = z.object({
  by: z.enum(subjects),
  key: z.string().min(1).optional(),
  max: z.number().int().positive(),
  message: z.string().min(1).optional(),
  metric: z.enum(["messages", "tokens"]),
  window: z
    .string()
    .regex(
      durationPattern,
      "Duration must be a positive integer followed by s, m, h, or d"
    ),
});

const paramsSchema = z
  .object({
    limits: z
      .array(rateLimitRuleSchema)
      .min(1, "At least one rate limit is required"),
  })
  .superRefine((params, context) => {
    const keys = new Set<string>();

    for (const [index, limit] of params.limits.entries()) {
      const key =
        limit.key ??
        defaultRuleKey(
          limit.by,
          parseDurationMs(limit.window),
          limit.max,
          limit.metric
        );
      if (keys.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate rate limit key: ${key}`,
          path: ["limits", index, "key"],
        });
      }
      keys.add(key);
    }
  });

type RateLimiterOptions = z.input<typeof paramsSchema>;
type ParsedOptions = z.output<typeof paramsSchema>;
type RateLimitSubject = (typeof subjects)[number];

interface NormalizedRule {
  by: RateLimitSubject;
  key: string;
  max: number;
  message: string;
  metric: "messages" | "tokens";
  windowMs: number;
}

class HookResponseError extends Error {
  readonly responseText: string;

  constructor(responseText: string) {
    super(responseText);
    this.name = "GoodchatHookResponseError";
    this.responseText = responseText;
  }
}

interface CounterRow {
  count: number;
  createdAt: Date;
  id: string;
  limitKey: string;
  subjectKey: string;
  subjectType: string;
  updatedAt: Date;
  windowEnd: Date;
  windowStart: Date;
}

const countersSchema = [
  {
    tableName: "counters",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      {
        columnName: "limit_key",
        dataType: "text",
        notNull: true,
        propertyName: "limitKey",
      },
      {
        columnName: "subject_type",
        dataType: "text",
        notNull: true,
        propertyName: "subjectType",
      },
      {
        columnName: "subject_key",
        dataType: "text",
        notNull: true,
        propertyName: "subjectKey",
      },
      {
        columnName: "window_start",
        dataType: "timestamp",
        notNull: true,
        propertyName: "windowStart",
      },
      {
        columnName: "window_end",
        dataType: "timestamp",
        notNull: true,
        propertyName: "windowEnd",
      },
      { columnName: "count", dataType: "integer", notNull: true },
      {
        columnName: "created_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "createdAt",
      },
      {
        columnName: "updated_at",
        dataType: "timestamp",
        notNull: true,
        propertyName: "updatedAt",
      },
    ],
    indexes: [
      {
        name: "idx_counters_lookup",
        columns: ["limit_key", "subject_type", "subject_key", "window_start"],
      },
      { name: "idx_counters_window_end", columns: ["window_end"] },
    ],
  },
] as const satisfies readonly SchemaTableDeclaration[];

const parseDurationMs = (duration: string): number => {
  const match = durationPattern.exec(duration);
  if (!match?.groups) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const unit = match.groups.unit as keyof typeof durationUnitMs;
  return Number(match.groups.amount) * durationUnitMs[unit];
};

const defaultRuleKey = (
  by: RateLimitSubject,
  windowMs: number,
  max: number,
  metric: "messages" | "tokens"
) => `${by}:${metric}:${max}:${windowMs}`;

const normalizeRules = (options: ParsedOptions): NormalizedRule[] =>
  options.limits.map((limit) => {
    const windowMs = parseDurationMs(limit.window);
    return {
      by: limit.by,
      key:
        limit.key ??
        defaultRuleKey(limit.by, windowMs, limit.max, limit.metric),
      max: limit.max,
      message: limit.message ?? defaultMessage,
      metric: limit.metric,
      windowMs,
    };
  });

const fixedWindow = (now: number, windowMs: number) => {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  return {
    windowEnd: new Date(windowStart + windowMs),
    windowStart: new Date(windowStart),
  };
};

const resolveSubjectKey = (rule: NormalizedRule, context: HookContext) => {
  switch (rule.by) {
    case "user":
      return context.userId;
    case "thread":
      return context.threadId;
    case "platform":
      return context.platform;
    case "global":
      return "global";
    case "channel":
      // Maps to platform until channelId is available in HookContext.
      return context.platform;
    default:
      return "global";
  }
};

const formatRetryAfter = (milliseconds: number) => {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  return `${Math.ceil(hours / 24)}d`;
};

type RateLimiterDb = HookDbCapability<typeof countersSchema>;

const logRateLimitDenied = ({
  context,
  retryAfter,
  rule,
  subjectKey,
}: {
  context: HookContext;
  retryAfter: string;
  rule: NormalizedRule;
  subjectKey: string;
}) => {
  context.log.set({
    rateLimiter: {
      matchedRules: 1,
      status: "denied",
    },
  });
  context.log.warn("Rate limit denied message", {
    rateLimit: {
      by: rule.by,
      limitKey: rule.key,
      max: rule.max,
      metric: rule.metric,
      retryAfter,
      subjectKey,
      windowMs: rule.windowMs,
    },
  });
};

const checkAndIncrement = (
  db: RateLimiterDb,
  rule: NormalizedRule,
  context: HookContext,
  now: Date,
  increment: number
) => {
  const { windowEnd, windowStart } = fixedWindow(now.getTime(), rule.windowMs);
  const subjectKey = resolveSubjectKey(rule, context);
  const where = {
    limitKey: rule.key,
    subjectKey,
    subjectType: rule.by,
    windowStart,
  } satisfies Partial<CounterRow>;

  return db.transaction(async (tx) => {
    const existing = await tx.query.counters.findFirst({ where });

    if (existing && existing.count >= rule.max) {
      const retryAfter = formatRetryAfter(windowEnd.getTime() - now.getTime());
      logRateLimitDenied({ context, retryAfter, rule, subjectKey });
      throw new HookResponseError(
        rule.message.replace("{retryAfter}", retryAfter)
      );
    }

    if (existing) {
      await tx
        .update(tx.tables.counters)
        .set({ count: existing.count + increment, updatedAt: now })
        .where(where)
        .execute();
      return;
    }

    await tx
      .insert(tx.tables.counters)
      .values({
        ...where,
        count: increment,
        createdAt: now,
        id: crypto.randomUUID(),
        updatedAt: now,
        windowEnd,
      })
      .execute();
  });
};

const CLEANUP_PROBABILITY = 0.02;

const rateLimiterDefinition = definePlugin({
  create: (_env, params: ParsedOptions) => {
    const rules = normalizeRules(params);
    const messageRules = rules.filter((r) => r.metric === "messages");
    const tokenRules = rules.filter((r) => r.metric === "tokens");

    return {
      hooks: {
        beforeMessage: async (context, db) => {
          const rateLimiterDb = db as RateLimiterDb;
          const now = new Date();

          if (Math.random() < CLEANUP_PROBABILITY) {
            await rateLimiterDb
              .delete(rateLimiterDb.tables.counters)
              .where({ windowEnd: { lt: now } })
              .execute();
          }

          context.log.set({
            rateLimiter: {
              messageRules: messageRules.length,
              status: "checking",
              tokenRules: tokenRules.length,
            },
          });

          for (const rule of messageRules) {
            await checkAndIncrement(rateLimiterDb, rule, context, now, 1);
          }

          // Check (but don't increment) token rules — tokens are unknown until afterMessage.
          for (const rule of tokenRules) {
            const { windowStart } = fixedWindow(now.getTime(), rule.windowMs);
            const subjectKey = resolveSubjectKey(rule, context);
            const existing = await rateLimiterDb.query.counters.findFirst({
              where: {
                limitKey: rule.key,
                subjectKey,
                subjectType: rule.by,
                windowStart,
              },
            });
            if (existing && existing.count >= rule.max) {
              const { windowEnd } = fixedWindow(now.getTime(), rule.windowMs);
              const retryAfter = formatRetryAfter(
                windowEnd.getTime() - now.getTime()
              );
              logRateLimitDenied({
                context,
                retryAfter,
                rule,
                subjectKey,
              });
              throw new HookResponseError(
                rule.message.replace("{retryAfter}", retryAfter)
              );
            }
          }
        },

        afterMessage: async (context, response, db) => {
          if (tokenRules.length === 0) {
            return;
          }
          const tokens = response.telemetry?.totalTokens;
          if (!tokens) {
            context.log.info("Rate limiter skipped token accounting", {
              rateLimit: {
                reason: "missing-token-telemetry",
                tokenRules: tokenRules.length,
              },
            });
            return;
          }

          context.log.set({
            rateLimiter: {
              status: "accounting-tokens",
              tokenRules: tokenRules.length,
              tokens,
            },
          });

          const rateLimiterDb = db as RateLimiterDb;
          const now = new Date();

          for (const rule of tokenRules) {
            await checkAndIncrement(rateLimiterDb, rule, context, now, tokens);
          }
        },
      },
    };
  },
  name: "rate-limiter",
  paramsSchema,
  schema: countersSchema,
});

export const rateLimiter = (
  options: RateLimiterOptions,
  config?: { key?: string }
) => rateLimiterDefinition(paramsSchema.parse(options), config);
