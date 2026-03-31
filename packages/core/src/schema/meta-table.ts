import { mysqlTable, text as mysqlText } from "drizzle-orm/mysql-core";
import { pgTable, text as pgText } from "drizzle-orm/pg-core";
import { sqliteTable, text as sqliteText } from "drizzle-orm/sqlite-core";
import type { SchemaDialect } from "./schema-types";

export const defineMetaTable = (dialect: SchemaDialect) => {
  if (dialect === "postgres") {
    return pgTable("goodchat_meta", {
      id: pgText("id").primaryKey(),
      schemaVersion: pgText("schema_version").notNull(),
    });
  }

  if (dialect === "sqlite") {
    return sqliteTable("goodchat_meta", {
      id: sqliteText("id").primaryKey(),
      schemaVersion: sqliteText("schema_version").notNull(),
    });
  }

  return mysqlTable("goodchat_meta", {
    id: mysqlText("id").primaryKey(),
    schemaVersion: mysqlText("schema_version").notNull(),
  });
};
