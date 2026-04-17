import type { Database } from "@goodchat/contracts/database/interface";
import type { AnyMySql2Connection } from "drizzle-orm/mysql2";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool } from "mysql2/promise";
import { createMysqlRepositories } from "./repositories-mysql";

export interface MysqlAdapterOptions {
  client?: AnyMySql2Connection;
  connectionString: string;
  debugLogs?: boolean;
  mode?: "default" | "planetscale";
  schema?: Record<string, unknown>;
}

export type MysqlDb = ReturnType<typeof drizzle>;
type MysqlTransaction = Parameters<Parameters<MysqlDb["transaction"]>[0]>[0];

export type MysqlDatabase = MysqlDb | MysqlTransaction;

type TransactionRunner = <T>(
  fn: (database: Database) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: MysqlDatabase,
  transactionRunner: TransactionRunner,
  authConfig: {
    db: unknown;
    provider: "mysql";
    schema?: Record<string, unknown>;
  }
): Database => ({
  ...createMysqlRepositories(database),
  auth: { getBetterAuthDatabaseConfig: () => authConfig },
  dialect: "mysql",
  transaction: transactionRunner,
});

export const mysql = (options: MysqlAdapterOptions): Database => {
  const client = options.client ?? createPool(options.connectionString);
  const db = drizzle(client, {
    logger: options.debugLogs,
    mode: options.mode ?? "default",
  });
  const authConfig = {
    db,
    provider: "mysql" as const,
    schema: options.schema,
  };
  const transactionRunner: TransactionRunner = (fn) =>
    db.transaction((tx) =>
      fn(createDatabaseInterface(tx, transactionRunner, authConfig))
    );
  return createDatabaseInterface(db, transactionRunner, authConfig);
};
