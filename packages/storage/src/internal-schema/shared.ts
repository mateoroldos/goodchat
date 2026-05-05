import { CORE_SCHEMA_TABLES } from "@goodchat/contracts/schema/declarations";
import type {
  SchemaColumnDeclaration,
  SchemaTableDeclaration,
} from "@goodchat/contracts/schema/types";
import {
  boolean,
  int,
  json,
  mysqlTable,
  text as mysqlText,
  timestamp as mysqlTimestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import {
  jsonb,
  boolean as pgBoolean,
  integer as pgInteger,
  pgTable,
  text as pgText,
  timestamp as pgTimestamp,
} from "drizzle-orm/pg-core";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { toPropertyName } from "../schema-declaration/shared";

const applyFlags = <T>(input: {
  column: SchemaColumnDeclaration;
  expression: T;
}): T => {
  let expression = input.expression as {
    notNull?: () => unknown;
    primaryKey?: () => unknown;
  };
  if (input.column.primaryKey && expression.primaryKey) {
    expression = expression.primaryKey() as typeof expression;
  }
  if (input.column.notNull && expression.notNull) {
    expression = expression.notNull() as typeof expression;
  }
  return expression as T;
};

const createColumn = (input: {
  builders: {
    boolean: (name: string) => unknown;
    id: (name: string) => unknown;
    integer: (name: string) => unknown;
    json: (name: string) => unknown;
    text: (name: string) => unknown;
    timestamp: (name: string) => unknown;
  };
  column: SchemaColumnDeclaration;
}): unknown => {
  const { builders, column } = input;
  if (column.dataType === "id") {
    return applyFlags({ column, expression: builders.id(column.columnName) });
  }
  if (column.dataType === "text") {
    return applyFlags({ column, expression: builders.text(column.columnName) });
  }
  if (column.dataType === "integer") {
    return applyFlags({
      column,
      expression: builders.integer(column.columnName),
    });
  }
  if (column.dataType === "json") {
    return applyFlags({ column, expression: builders.json(column.columnName) });
  }
  if (column.dataType === "timestamp") {
    return applyFlags({
      column,
      expression: builders.timestamp(column.columnName),
    });
  }
  return applyFlags({
    column,
    expression: builders.boolean(column.columnName),
  });
};

const createColumns = (input: {
  builders: {
    boolean: (name: string) => unknown;
    id: (name: string) => unknown;
    integer: (name: string) => unknown;
    json: (name: string) => unknown;
    text: (name: string) => unknown;
    timestamp: (name: string) => unknown;
  };
  table: SchemaTableDeclaration;
}): Record<string, unknown> => {
  return Object.fromEntries(
    input.table.columns.map((column) => {
      return [
        toPropertyName(column),
        createColumn({ builders: input.builders, column }),
      ] as const;
    })
  );
};

export const createSchemaTableMap = <T>(input: {
  tableBuilder: (tableName: string, columns: Record<string, unknown>) => T;
  tables: readonly SchemaTableDeclaration[];
  typeBuilders: {
    boolean: (name: string) => unknown;
    id: (name: string) => unknown;
    integer: (name: string) => unknown;
    json: (name: string) => unknown;
    text: (name: string) => unknown;
    timestamp: (name: string) => unknown;
  };
}): Record<string, T> => {
  return Object.fromEntries(
    input.tables.map((table) => {
      return [
        table.tableName,
        input.tableBuilder(
          table.tableName,
          createColumns({ builders: input.typeBuilders, table })
        ),
      ] as const;
    })
  );
};

export const SQLITE_DECLARATION_TYPE_BUILDERS = {
  id: (name: string) => text(name),
  text: (name: string) => text(name),
  integer: (name: string) => integer(name),
  boolean: (name: string) => integer(name, { mode: "boolean" }),
  json: (name: string) => text(name, { mode: "json" }),
  timestamp: (name: string) => integer(name, { mode: "timestamp" }),
};

export const POSTGRES_DECLARATION_TYPE_BUILDERS = {
  id: (name: string) => pgText(name),
  text: (name: string) => pgText(name),
  integer: (name: string) => pgInteger(name),
  boolean: (name: string) => pgBoolean(name),
  json: (name: string) => jsonb(name),
  timestamp: (name: string) => pgTimestamp(name),
};

export const MYSQL_DECLARATION_TYPE_BUILDERS = {
  id: (name: string) => varchar(name, { length: 191 }),
  text: (name: string) => mysqlText(name),
  integer: (name: string) => int(name),
  boolean: (name: string) => boolean(name),
  json: (name: string) => json(name),
  timestamp: (name: string) => mysqlTimestamp(name),
};

export const createSqliteDeclarationTableMap = (
  tables: readonly SchemaTableDeclaration[]
): Record<string, unknown> => {
  return createSchemaTableMap({
    tableBuilder: (tableName, columns) =>
      sqliteTable(
        tableName,
        columns as unknown as Parameters<typeof sqliteTable>[1]
      ),
    tables,
    typeBuilders: SQLITE_DECLARATION_TYPE_BUILDERS,
  });
};

export const createPostgresDeclarationTableMap = (
  tables: readonly SchemaTableDeclaration[]
): Record<string, unknown> => {
  return createSchemaTableMap({
    tableBuilder: (tableName, columns) =>
      pgTable(tableName, columns as unknown as Parameters<typeof pgTable>[1]),
    tables,
    typeBuilders: POSTGRES_DECLARATION_TYPE_BUILDERS,
  });
};

export const createMysqlDeclarationTableMap = (
  tables: readonly SchemaTableDeclaration[]
): Record<string, unknown> => {
  return createSchemaTableMap({
    tableBuilder: (tableName, columns) =>
      mysqlTable(
        tableName,
        columns as unknown as Parameters<typeof mysqlTable>[1]
      ),
    tables,
    typeBuilders: MYSQL_DECLARATION_TYPE_BUILDERS,
  });
};

export const createCoreSchema = <T>(input: {
  tableBuilder: (tableName: string, columns: Record<string, unknown>) => T;
  typeBuilders: {
    boolean: (name: string) => unknown;
    id: (name: string) => unknown;
    integer: (name: string) => unknown;
    json: (name: string) => unknown;
    text: (name: string) => unknown;
    timestamp: (name: string) => unknown;
  };
}): {
  aiRunToolCalls: T;
  aiRuns: T;
  messages: T;
  threads: T;
} => {
  const tables = createSchemaTableMap({
    tableBuilder: input.tableBuilder,
    tables: CORE_SCHEMA_TABLES,
    typeBuilders: input.typeBuilders,
  }) as {
    ai_run_tool_calls: T;
    ai_runs: T;
    messages: T;
    threads: T;
  };

  return {
    aiRuns: tables.ai_runs,
    aiRunToolCalls: tables.ai_run_tool_calls,
    threads: tables.threads,
    messages: tables.messages,
  };
};
