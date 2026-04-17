import type { Database } from "@goodchat/contracts/database/interface";
import { sql } from "@vercel/postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNodePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePostgresJs } from "drizzle-orm/postgres-js";
import { drizzle as drizzleVercel } from "drizzle-orm/vercel-postgres";
import { Pool } from "pg";
import postgresJs from "postgres";
import { postgresSchema } from "../schema/postgres";
import { createRepositories } from "./repository";

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
  transactionRunner: TransactionRunner,
  authConfig: {
    db: unknown;
    provider: "pg";
    schema?: Record<string, unknown>;
  }
): Database => ({
  ...createRepositories(postgresSchema, database),
  auth: { getBetterAuthDatabaseConfig: () => authConfig },
  dialect: "postgres",
  transaction: transactionRunner,
});

export const postgres = (options: PostgresAdapterOptions): Database => {
  const db = createDriverDatabase(options);
  const authConfig = {
    db,
    provider: "pg" as const,
    schema: options.schema,
  };
  const transactionRunner: TransactionRunner = (fn) =>
    db.transaction((tx) =>
      fn(createDatabaseInterface(tx, transactionRunner, authConfig))
    );
  return createDatabaseInterface(db, transactionRunner, authConfig);
};

const createDriverDatabase = (
  options: PostgresAdapterOptions
): PostgresDatabase => {
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
