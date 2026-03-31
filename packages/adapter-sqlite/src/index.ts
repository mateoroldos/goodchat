import type { Database } from "@goodchat/contracts/database/interface";
import type { SqliteAdapterOptions } from "./client";
import { createSqliteDatabase } from "./client";

export const sqlite = (options: SqliteAdapterOptions): Database => {
  return createSqliteDatabase(options);
};

export type { SqliteAdapterOptions } from "./client";
