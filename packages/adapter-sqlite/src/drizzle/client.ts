import type { Database } from "@goodchat/contracts/database/interface";

export interface SqliteAdapterOptions {
  debugLogs?: boolean;
  path: string;
}

export type SqliteDatabase = unknown;

export const createSqliteDatabase = (
  options: SqliteAdapterOptions
): Database => {
  throw new Error(`Not implemented: ${options.path}`);
};
