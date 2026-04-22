import { Database as BunSqliteDatabase } from "bun:sqlite";
import type { Database } from "@goodchat/contracts/database/interface";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { createSqliteRepositories } from "./repositories-sqlite";

export interface SqliteAdapterOptions {
  client?: BunSqliteDatabase;
  debugLogs?: boolean;
  path: string;
  schema?: Record<string, unknown>;
}

type SqliteDb = ReturnType<typeof drizzle>;
type SqliteTransaction = Parameters<Parameters<SqliteDb["transaction"]>[0]>[0];

export type SqliteDatabase = SqliteDb | SqliteTransaction;

/** Narrowed Database with a typed drizzle connection for SQLite. */
export type SqliteDatabaseInstance = Database<SqliteDb, "sqlite">;

type TransactionRunner = <T>(
  fn: (database: SqliteDatabaseInstance) => Promise<T>
) => Promise<T>;

export const createDatabaseInterface = (
  database: SqliteDatabase,
  transactionRunner: TransactionRunner,
  connection: SqliteDb,
  schema: Record<string, unknown> | undefined
): SqliteDatabaseInstance => ({
  ...createSqliteRepositories(database),
  connection,
  dialect: "sqlite",
  schema,
  transaction: transactionRunner,
});

export const sqlite = (
  options: SqliteAdapterOptions
): SqliteDatabaseInstance => {
  const client = options.client ?? new BunSqliteDatabase(options.path);
  const db = drizzle(client, { logger: options.debugLogs });
  const transactionRunner: TransactionRunner = (fn) =>
    db.transaction((tx) =>
      fn(createDatabaseInterface(tx, transactionRunner, db, options.schema))
    );
  return createDatabaseInterface(db, transactionRunner, db, options.schema);
};
