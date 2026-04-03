import type { Database } from "@goodchat/contracts/database/interface";
import { sql } from "@vercel/postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { Pool } from "pg";
import postgres from "postgres";
import { createPostgresRepositories } from "./repository";
import { ensureSchemaVersion } from "./version-check";

export type PostgresDriver =
  | "postgres-js"
  | "pg"
  | "@neondatabase/serverless"
  | "@vercel/postgres";

type PostgresJsClient = ReturnType<typeof postgres>;
type NodePgClient = Pool;

interface BasePostgresAdapterOptions {
  connectionString: string;
  debugLogs?: boolean;
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

export type PostgresDatabase =
  | ReturnType<typeof drizzlePostgresJs>
  | ReturnType<typeof drizzleNodePg>
  | ReturnType<typeof drizzleNeon>
  | ReturnType<typeof drizzleVercel>
  | PostgresJsTransaction
  | NodePgTransaction
  | NeonTransaction
  | VercelTransaction;

type TransactionRunner = <T>(
  fn: (database: Database) => Promise<T>
) => Promise<T>;

const createDatabaseInterface = (
  database: PostgresDatabase,
  transactionRunner: TransactionRunner
): Database => {
  const repositories = createPostgresRepositories(database);
  return {
    ...repositories,
    ensureSchemaVersion: () => ensureSchemaVersion(database),
    transaction: transactionRunner,
  };
};

export const createPostgresDatabase = (
  options: PostgresAdapterOptions
): Database => {
  const database = createDriverDatabase(options);
  const transactionRunner: TransactionRunner = (fn) =>
    database.transaction((transaction) =>
      fn(createDatabaseInterface(transaction, transactionRunner))
    );

  return createDatabaseInterface(database, transactionRunner);
};

const createDriverDatabase = (
  options: PostgresAdapterOptions
): PostgresDatabase => {
  const drizzleConfig = {
    logger: options.debugLogs,
  };

  if (options.driver === "pg") {
    const client =
      options.client ??
      new Pool({ connectionString: options.connectionString });
    return drizzleNodePg(client, drizzleConfig);
  }

  if (options.driver === "@neondatabase/serverless") {
    return drizzleNeon(options.connectionString, drizzleConfig);
  }

  if (options.driver === "@vercel/postgres") {
    return drizzleVercel(sql, drizzleConfig);
  }

  const client = options.client ?? postgres(options.connectionString);
  return drizzlePostgresJs(client, drizzleConfig);
};
