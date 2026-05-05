import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rateLimiterCounters = sqliteTable("rate_limiter_counters", {
  id: text("id").primaryKey(),
  limitKey: text("limit_key").notNull(),
  subjectType: text("subject_type").notNull(),
  subjectKey: text("subject_key").notNull(),
  windowStart: integer("window_start", { mode: "timestamp" }).notNull(),
  windowEnd: integer("window_end", { mode: "timestamp" }).notNull(),
  count: integer("count").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pluginSchema = {
  rateLimiterCounters,
};
