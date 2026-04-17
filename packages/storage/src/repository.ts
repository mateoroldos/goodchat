import type { Database } from "@goodchat/contracts/database/interface";
import { mysqlSchema } from "../schema/mysql";
import { postgresSchema } from "../schema/postgres";
import type { MysqlDatabase } from "./mysql";
import type { PostgresDatabase } from "./postgres";
import { createMysqlRepositories } from "./repositories-mysql";
import { createPostgresRepositories } from "./repositories-postgres";
import { createSqliteRepositories } from "./repositories-sqlite";
import type { SqliteDatabase } from "./sqlite";

type Repositories = Pick<
  Database,
  "aiRuns" | "aiRunToolCalls" | "messages" | "threads"
>;

export function createRepositories(
  schema: typeof mysqlSchema,
  db: MysqlDatabase
): Repositories;
export function createRepositories(
  schema: typeof postgresSchema,
  db: PostgresDatabase
): Repositories;
export function createRepositories(
  schema: typeof import("../schema/sqlite").sqliteSchema,
  db: SqliteDatabase
): Repositories;
export function createRepositories(
  schema:
    | typeof mysqlSchema
    | typeof postgresSchema
    | typeof import("../schema/sqlite").sqliteSchema,
  db: MysqlDatabase | PostgresDatabase | SqliteDatabase
): Repositories {
  if (schema === mysqlSchema) {
    return createMysqlRepositories(db as MysqlDatabase);
  }

  if (schema === postgresSchema) {
    return createPostgresRepositories(db as PostgresDatabase);
  }

  return createSqliteRepositories(db as SqliteDatabase);
}
