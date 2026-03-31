import type { Database } from "@goodchat/contracts/database/interface";
import type { SqliteAdapterOptions } from "./drizzle/client";
import { createSqliteDatabase } from "./drizzle/client";

export const sqlite = (options: SqliteAdapterOptions): Database => {
  return createSqliteDatabase(options);
};

export type { SqliteAdapterOptions } from "./drizzle/client";
