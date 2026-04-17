import { Database as BunSqliteDatabase } from "bun:sqlite";
import type { Database } from "@goodchat/contracts/database/interface";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { sqliteSchema } from "../schema/sqlite";
import { createRepositories } from "./repository";

export interface SqliteAdapterOptions {
  client?: BunSqliteDatabase;
  debugLogs?: boolean;
  path: string;
  schema?: Record<string, unknown>;
}

type SqliteDb = ReturnType<typeof drizzle>;
type SqliteTransaction = Parameters<Parameters<SqliteDb["transaction"]>[0]>[0];

export type SqliteDatabase = SqliteDb | SqliteTransaction;

type TransactionRunner = <T>(
  fn: (database: Database) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: SqliteDatabase,
  transactionRunner: TransactionRunner,
  authConfig: {
    db: unknown;
    provider: "sqlite";
    schema?: Record<string, unknown>;
  }
): Database => ({
  ...createRepositories(sqliteSchema, database),
  auth: { getBetterAuthDatabaseConfig: () => authConfig },
  dialect: "sqlite",
  transaction: transactionRunner,
});

export const sqlite = (options: SqliteAdapterOptions): Database => {
  const client = options.client ?? new BunSqliteDatabase(options.path);
  const db = drizzle(client, { logger: options.debugLogs });
  const authConfig = {
    db,
    provider: "sqlite" as const,
    schema: options.schema,
  };
  const transactionRunner: TransactionRunner = (fn) =>
    db.transaction((tx) =>
      fn(createDatabaseInterface(tx, transactionRunner, authConfig))
    );
  return createDatabaseInterface(db, transactionRunner, authConfig);
};
