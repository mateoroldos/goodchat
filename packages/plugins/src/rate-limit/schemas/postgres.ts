import { index, integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const rateLimitWindows = pgTable(
  "rate_limit_windows",
  {
    bucketStart: text("bucket_start").notNull(),
    bucketType: text("bucket_type").notNull(),
    bucketValue: text("bucket_value").notNull(),
    count: integer("count").notNull(),
    rule: text("rule").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_rl_windows_bucket").on(
      table.rule,
      table.bucketValue,
      table.updatedAt
    ),
  ]
);

export const rateLimitLeases = pgTable("rate_limit_leases", {
  activeCount: integer("active_count").notNull(),
  expiresAt: text("expires_at").notNull(),
  threadId: text("thread_id").primaryKey(),
  updatedAt: text("updated_at").notNull(),
});

export const rateLimitCooldowns = pgTable("rate_limit_cooldowns", {
  expiresAt: text("expires_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  userId: text("user_id").primaryKey(),
});

export const rateLimitViolations = pgTable(
  "rate_limit_violations",
  {
    createdAt: text("created_at").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [index("idx_rl_violations_user").on(table.userId, table.createdAt)]
);

export const rateLimitTokenUsage = pgTable(
  "rate_limit_token_usage",
  {
    bucketGranularity: text("bucket_granularity").notNull(),
    bucketStart: text("bucket_start").notNull(),
    tokens: integer("tokens").notNull(),
    updatedAt: text("updated_at").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.bucketGranularity, table.bucketStart],
    }),
    index("idx_rl_token_usage_lookup").on(
      table.userId,
      table.bucketGranularity,
      table.bucketStart
    ),
  ]
);

export const rateLimitTokenUsageSync = pgTable("rate_limit_token_usage_sync", {
  cursorCreatedAt: text("cursor_created_at").notNull(),
  cursorRunId: text("cursor_run_id").notNull(),
  id: text("id").primaryKey(),
  updatedAt: text("updated_at").notNull(),
});

export const rateLimitSchema = {
  rateLimitCooldowns,
  rateLimitLeases,
  rateLimitTokenUsage,
  rateLimitTokenUsageSync,
  rateLimitViolations,
  rateLimitWindows,
};
