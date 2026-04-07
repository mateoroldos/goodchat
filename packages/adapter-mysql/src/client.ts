import type { Database } from "@goodchat/contracts/database/interface";
import type { AnyMySql2Connection } from "drizzle-orm/mysql2";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { createMysqlRepositories } from "./repository";
import { ensureSchemaVersion } from "./version-check";

export interface MysqlAdapterOptions {
  client?: AnyMySql2Connection;
  connectionString: string;
  debugLogs?: boolean;
  mode?: "default" | "planetscale";
}

type MysqlTransaction = Parameters<
  Parameters<ReturnType<typeof drizzle>["transaction"]>[0]
>[0];

export type MysqlDatabase = ReturnType<typeof drizzle> | MysqlTransaction;

type TransactionRunner = <T>(
  fn: (database: Database) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: MysqlDatabase,
  transactionRunner: TransactionRunner
): Database => {
  const repositories = createMysqlRepositories(database);
  return {
    ...repositories,
    dialect: "mysql",
    ensureSchemaVersion: () => ensureSchemaVersion(database),
    transaction: transactionRunner,
  };
};

export const createMysqlDatabase = (options: MysqlAdapterOptions): Database => {
  const client = options.client ?? createPool(options.connectionString);
  const database = drizzle(client, {
    logger: options.debugLogs,
    mode: options.mode ?? "default",
  });
  const transactionRunner: TransactionRunner = (fn) =>
    database.transaction((transaction) =>
      fn(createDatabaseInterface(transaction, transactionRunner))
    );

  return createDatabaseInterface(database, transactionRunner);
};
