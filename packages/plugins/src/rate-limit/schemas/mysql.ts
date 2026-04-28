import {
  index,
  int,
  mysqlTable,
  primaryKey,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

export const rateLimitWindows = mysqlTable(
  "rate_limit_windows",
  {
    bucketStart: text("bucket_start").notNull(),
    bucketType: text("bucket_type").notNull(),
    bucketValue: text("bucket_value").notNull(),
    count: int("count").notNull(),
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

export const rateLimitLeases = mysqlTable("rate_limit_leases", {
  activeCount: int("active_count").notNull(),
  expiresAt: text("expires_at").notNull(),
  // varchar(191) is MySQL's max length for a single-column utf8mb4 index
  threadId: varchar("thread_id", { length: 191 }).primaryKey(),
  updatedAt: text("updated_at").notNull(),
});

export const rateLimitCooldowns = mysqlTable("rate_limit_cooldowns", {
  expiresAt: text("expires_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  userId: varchar("user_id", { length: 191 }).primaryKey(),
});

export const rateLimitViolations = mysqlTable(
  "rate_limit_violations",
  {
    createdAt: text("created_at").notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [index("idx_rl_violations_user").on(table.userId, table.createdAt)]
);

export const rateLimitTokenUsage = mysqlTable(
  "rate_limit_token_usage",
  {
    bucketGranularity: varchar("bucket_granularity", { length: 16 }).notNull(),
    bucketStart: varchar("bucket_start", { length: 191 }).notNull(),
    tokens: int("tokens").notNull(),
    updatedAt: text("updated_at").notNull(),
    userId: varchar("user_id", { length: 191 }).notNull(),
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

export const rateLimitTokenUsageSync = mysqlTable(
  "rate_limit_token_usage_sync",
  {
    cursorCreatedAt: text("cursor_created_at").notNull(),
    cursorRunId: varchar("cursor_run_id", { length: 191 }).notNull(),
    id: varchar("id", { length: 64 }).primaryKey(),
    updatedAt: text("updated_at").notNull(),
  }
);

export const rateLimitSchema = {
  rateLimitCooldowns,
  rateLimitLeases,
  rateLimitTokenUsage,
  rateLimitTokenUsageSync,
  rateLimitViolations,
  rateLimitWindows,
};
