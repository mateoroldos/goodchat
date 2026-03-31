import type { Database } from "@goodchat/contracts/database/interface";
import type { PostgresAdapterOptions } from "./drizzle/client";
import { createPostgresDatabase } from "./drizzle/client";

export const postgres = (options: PostgresAdapterOptions): Database => {
  return createPostgresDatabase(options);
};

export type { PostgresAdapterOptions } from "./drizzle/client";
