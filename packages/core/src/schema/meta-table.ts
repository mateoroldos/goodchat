import {
  mysqlTable,
  text as mysqlText,
  varchar as mysqlVarchar,
} from "drizzle-orm/mysql-core";
import { pgTable, text as pgText } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import type { SchemaDialect } from "./schema-types";

const definePostgresMetaTable = () =>
  pgTable("goodchat_meta", {
    id: pgText("id").primaryKey(),
    schemaVersion: pgText("schema_version").notNull(),
  });

const defineSqliteMetaTable = () =>
  sqliteTable("goodchat_meta", {
    id: sqliteText("id").primaryKey(),
    schemaVersion: sqliteText("schema_version").notNull(),
  });

const defineMysqlMetaTable = () =>
  mysqlTable("goodchat_meta", {
    id: mysqlVarchar("id", { length: 191 }).primaryKey(),
    schemaVersion: mysqlText("schema_version").notNull(),
  });

export type PostgresMetaTable = ReturnType<typeof definePostgresMetaTable>;
export type SqliteMetaTable = ReturnType<typeof defineSqliteMetaTable>;
export type MysqlMetaTable = ReturnType<typeof defineMysqlMetaTable>;

export function defineMetaTable(dialect: "postgres"): PostgresMetaTable;
export function defineMetaTable(dialect: "sqlite"): SqliteMetaTable;
export function defineMetaTable(dialect: "mysql"): MysqlMetaTable;
export function defineMetaTable(dialect: SchemaDialect) {
  if (dialect === "postgres") {
    return definePostgresMetaTable();
  }

  if (dialect === "sqlite") {
    return defineSqliteMetaTable();
  }

  return defineMysqlMetaTable();
}
