import type { Database } from "@goodchat/contracts/database/interface";
import { sql } from "@vercel/postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { Pool } from "pg";
import postgresJs from "postgres";
import { createPostgresRepositories } from "./repositories-postgres";

export type PostgresDriver =
  | "postgres-js"
  | "pg"
  | "@neondatabase/serverless"
  | "@vercel/postgres";

type PostgresJsClient = ReturnType<typeof postgresJs>;
type NodePgClient = Pool;

interface BasePostgresAdapterOptions {
  connectionString: string;
  debugLogs?: boolean;
  schema?: Record<string, unknown>;
}

export type PostgresAdapterOptions =
  | (BasePostgresAdapterOptions & {
      driver?: "postgres-js";
      client?: PostgresJsClient;
    })
  | (BasePostgresAdapterOptions & { driver: "pg"; client?: NodePgClient })
  | (BasePostgresAdapterOptions & {
      driver: "@neondatabase/serverless";
    })
  | (BasePostgresAdapterOptions & {
      driver: "@vercel/postgres";
    });

type PostgresJsTransaction = Parameters<
  Parameters<ReturnType<typeof drizzlePostgresJs>["transaction"]>[0]
>[0];
type NodePgTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleNodePg>["transaction"]>[0]
>[0];
type NeonTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleNeon>["transaction"]>[0]
>[0];
type VercelTransaction = Parameters<
  Parameters<ReturnType<typeof drizzleVercel>["transaction"]>[0]
>[0];

/** Top-level (non-transaction) drizzle connection types for Postgres. */
export type PostgresTopLevelDb =
  | ReturnType<typeof drizzlePostgresJs>
  | ReturnType<typeof drizzleNodePg>
  | ReturnType<typeof drizzleNeon>
  | ReturnType<typeof drizzleVercel>;

export type PostgresDatabase =
  | PostgresTopLevelDb
  | PostgresJsTransaction
  | NodePgTransaction
  | NeonTransaction
  | VercelTransaction;

/** Narrowed Database with a typed drizzle connection for Postgres. */
export type PostgresDatabaseInstance = Database<PostgresTopLevelDb, "postgres">;

type TransactionRunner = <T>(
  fn: (database: PostgresDatabaseInstance) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: PostgresDatabase,
  transactionRunner: TransactionRunner,
  connection: PostgresTopLevelDb,
  schema: Record<string, unknown> | undefined
): PostgresDatabaseInstance => ({
  ...createPostgresRepositories(database),
  connection,
  dialect: "postgres",
  schema,
  transaction: transactionRunner,
});

export const postgres = (
  options: PostgresAdapterOptions
): PostgresDatabaseInstance => {
  const db = createDriverDatabase(options);
  const transactionRunner: TransactionRunner = (fn) =>
    db.transaction((tx) =>
      fn(createDatabaseInterface(tx, transactionRunner, db, options.schema))
    );
  return createDatabaseInterface(db, transactionRunner, db, options.schema);
};

const createDriverDatabase = (
  options: PostgresAdapterOptions
): PostgresTopLevelDb => {
  const config = { logger: options.debugLogs };

  if (options.driver === "pg") {
    const client =
      options.client ??
      new Pool({ connectionString: options.connectionString });
    return drizzleNodePg(client, config);
  }

  if (options.driver === "@neondatabase/serverless") {
    return drizzleNeon(options.connectionString, config);
  }

  if (options.driver === "@vercel/postgres") {
    return drizzleVercel(sql, config);
  }

  const client = options.client ?? postgresJs(options.connectionString);
  return drizzlePostgresJs(client, config);
};
