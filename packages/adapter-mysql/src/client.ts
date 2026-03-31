import type { Database } from "@goodchat/contracts/database/interface";
import { mysqlSchema } from "@goodchat/core/schema";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { createMysqlRepositories } from "./repository";
import { ensureSchemaVersion } from "./version-check";

export interface MysqlAdapterOptions {
  client?: unknown;
  connectionString: string;
  debugLogs?: boolean;
  mode?: "default" | "planetscale";
}

export type MysqlDatabase = ReturnType<typeof drizzle>;

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
    ensureSchemaVersion: () => ensureSchemaVersion(database),
    transaction: transactionRunner,
  };
};

export const createMysqlDatabase = (options: MysqlAdapterOptions): Database => {
  const client = options.client ?? createPool(options.connectionString);
  const database = drizzle(client, {
    logger: options.debugLogs,
    schema: mysqlSchema,
    mode: options.mode ?? "default",
  });
  const transactionRunner: TransactionRunner = (fn) =>
    database.transaction(
      (
        transaction: Parameters<Parameters<MysqlDatabase["transaction"]>[0]>[0]
      ) => fn(createDatabaseInterface(transaction, transactionRunner))
    );

  return createDatabaseInterface(database, transactionRunner);
};
