import type { Database } from "@goodchat/contracts/database/interface";
import type { SqliteDatabase } from "./client";

export const createSqliteRepositories = (
  database: SqliteDatabase
): Pick<Database, "messages" | "threads"> => {
  throw new Error(`Not implemented: ${String(database)}`);
};
