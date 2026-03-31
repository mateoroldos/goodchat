import type { PostgresDatabase } from "./client";

export const ensureSchemaVersion = (
  database: PostgresDatabase
): Promise<void> => {
  return Promise.reject(new Error(`Not implemented: ${String(database)}`));
};
