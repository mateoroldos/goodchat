import { Database as BunSqliteDatabase } from "bun:sqlite";
import type { Database } from "@goodchat/contracts/database/interface";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { createSqliteRepositories } from "./repository";

export interface SqliteAdapterOptions {
  client?: BunSqliteDatabase;
  debugLogs?: boolean;
  path: string;
  schema?: Record<string, unknown>;
}

type BunSqliteTransaction = Parameters<
  Parameters<ReturnType<typeof drizzle>["transaction"]>[0]
>[0];

export type SqliteDatabase = ReturnType<typeof drizzle> | BunSqliteTransaction;

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
): Database => {
  const repositories = createSqliteRepositories(database);
  return {
    ...repositories,
    auth: {
      getBetterAuthDatabaseConfig: () => authConfig,
    },
    dialect: "sqlite",
    transaction: transactionRunner,
  };
};

export const createSqliteDatabase = (
  options: SqliteAdapterOptions
): Database => {
  const client = options.client ?? new BunSqliteDatabase(options.path);
  const database = drizzle(client, {
    logger: options.debugLogs,
  });
  const authConfig = {
    db: database,
    provider: "sqlite" as const,
    schema: options.schema,
  };
  const transactionRunner: TransactionRunner = (fn) =>
    database.transaction((transaction) => {
      return fn(
        createDatabaseInterface(transaction, transactionRunner, authConfig)
      );
    });

  return createDatabaseInterface(database, transactionRunner, authConfig);
};
