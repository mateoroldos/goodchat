import type { MysqlDatabase } from "./client";

export const ensureSchemaVersion = (database: MysqlDatabase): Promise<void> => {
  return Promise.reject(new Error(`Not implemented: ${String(database)}`));
};
