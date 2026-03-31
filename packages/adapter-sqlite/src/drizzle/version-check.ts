import type { SqliteDatabase } from "./client";

export const ensureSchemaVersion = (
  database: SqliteDatabase
): Promise<void> => {
  return Promise.reject(new Error(`Not implemented: ${String(database)}`));
};
