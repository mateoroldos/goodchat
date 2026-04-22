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

/** Narrowed Database with a typed drizzle connection for MySQL. */
export type MysqlDatabaseInstance = Database<MysqlDb, "mysql">;

type TransactionRunner = <T>(
  fn: (database: MysqlDatabaseInstance) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: MysqlDatabase,
  transactionRunner: TransactionRunner,
  connection: MysqlDb,
  schema: Record<string, unknown> | undefined
): MysqlDatabaseInstance => ({
  ...createMysqlRepositories(database),
  connection,
  dialect: "mysql",
  schema,
  transaction: transactionRunner,
});

export const mysql = (options: MysqlAdapterOptions): MysqlDatabaseInstance => {
  const client = options.client ?? createPool(options.connectionString);
  const db = drizzle(client, {
    logger: options.debugLogs,
    mode: options.mode ?? "default",
  });
  const transactionRunner: TransactionRunner = (fn) =>
    db.transaction((tx) =>
      fn(createDatabaseInterface(tx, transactionRunner, db, options.schema))
    );
  return createDatabaseInterface(db, transactionRunner, db, options.schema);
};
