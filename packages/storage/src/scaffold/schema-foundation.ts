import {
  AUTH_SCHEMA_TABLES_BY_DIALECT,
  CORE_SCHEMA_TABLES,
} from "@goodchat/contracts/schema/declarations";
import type {
  PluginSchemaDeclaration,
  SchemaColumnDeclaration,
  SchemaDialect,
  SchemaTableDeclaration,
} from "@goodchat/contracts/schema/types";
import {
  renderScalarExpression,
  toPropertyName,
  toVariableName,
} from "../schema-declaration/shared";

export type Dialect = SchemaDialect;

const DIALECT_TABLE_IMPORTS = {
  mysql:
    'import { boolean, int, json, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";',
  postgres:
    'import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";',
  sqlite:
    'import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";',
} as const satisfies Record<Dialect, string>;

const RELATIONS_IMPORT = 'import { relations } from "drizzle-orm";';

const CORE_SCHEMA_EXPORT = {
  mysql: "mysqlSchema",
  postgres: "postgresSchema",
  sqlite: "sqliteSchema",
} as const satisfies Record<Dialect, string>;

const renderColumn = (
  dialect: Dialect,
  column: SchemaColumnDeclaration
): string => {
  let expr = renderScalarExpression({
    dialect,
    dataType: column.dataType,
    propertyName: toPropertyName(column),
    columnName: column.columnName,
  });
  if (column.primaryKey) {
    expr = `${expr}.primaryKey()`;
  }
  if (column.notNull) {
    expr = `${expr}.notNull()`;
  }
  if (column.unique) {
    expr = `${expr}.unique()`;
  }
  return expr;
};

const renderRelations = (table: SchemaTableDeclaration): string => {
  if (!table.relations || table.relations.length === 0) {
    return "";
  }
  const tableVariable = toVariableName(table.tableName);
  const lines = table.relations
    .map((relation) => {
      const targetVar = toVariableName(relation.targetTable);
      if (relation.kind === "many") {
        return `  ${relation.name}: many(${targetVar}),`;
      }
      return `  ${relation.name}: one(${targetVar}, { fields: [${(relation.fields ?? []).map((item) => `${tableVariable}.${item}`).join(", ")}], references: [${(relation.references ?? []).map((item) => `${targetVar}.${item}`).join(", ")}] }),`;
    })
    .join("\n");
  const hasOne = table.relations.some((r) => r.kind !== "many");
  const hasMany = table.relations.some((r) => r.kind === "many");
  const params = [hasOne && "one", hasMany && "many"]
    .filter(Boolean)
    .join(", ");
  return `\nexport const ${tableVariable}Relations = relations(${tableVariable}, ({ ${params} }) => ({\n${lines}\n}));`;
};

const renderTables = (
  dialect: Dialect,
  tables: readonly SchemaTableDeclaration[]
): string => {
  let tableFactory: "sqliteTable" | "pgTable" | "mysqlTable";
  if (dialect === "sqlite") {
    tableFactory = "sqliteTable";
  } else if (dialect === "postgres") {
    tableFactory = "pgTable";
  } else {
    tableFactory = "mysqlTable";
  }

  const tableDefs = tables
    .map((table) => {
      const columns = table.columns
        .map((column) => `  ${renderColumn(dialect, column)},`)
        .join("\n");
      return `export const ${toVariableName(table.tableName)} = ${tableFactory}("${table.tableName}", {\n${columns}\n});`;
    })
    .join("\n\n");
  const relationDefs = tables.map((table) => renderRelations(table)).join("\n");
  return `${tableDefs}${relationDefs}`;
};

const buildImports = (
  dialect: Dialect,
  tables: readonly SchemaTableDeclaration[]
): string => {
  const hasRelations = tables.some(
    (t) => t.relations && t.relations.length > 0
  );
  return hasRelations
    ? `${DIALECT_TABLE_IMPORTS[dialect]}\n${RELATIONS_IMPORT}`
    : DIALECT_TABLE_IMPORTS[dialect];
};

export const emitCoreDrizzleSchema = (dialect: Dialect): string => {
  const tables = renderTables(dialect, CORE_SCHEMA_TABLES);
  return `${buildImports(dialect, CORE_SCHEMA_TABLES)}\n\n${tables}\n\nexport const ${CORE_SCHEMA_EXPORT[dialect]} = {\n  aiRuns,\n  aiRunToolCalls,\n  threads,\n  messages,\n};\n`;
};

export const emitAuthDrizzleSchema = (dialect: Dialect): string => {
  const authTables = AUTH_SCHEMA_TABLES_BY_DIALECT[dialect];
  const tables = renderTables(dialect, authTables);
  return `${buildImports(dialect, authTables)}\n\n${tables}\n\nexport const authSchema = {\n  user,\n  session,\n  account,\n  verification,\n};\n`;
};

export const emitPluginDrizzleSchema = (input: {
  declarations: readonly PluginSchemaDeclaration[];
  dialect: Dialect;
}): string => {
  const tables = input.declarations.flatMap(
    (declaration) => declaration.tables
  );
  if (tables.length === 0) {
    return "export const pluginSchema = {};\n";
  }

  const renderedTables = renderTables(input.dialect, tables);
  const schemaEntries = tables.map(
    (table) => `  ${toVariableName(table.tableName)},`
  );

  return `${buildImports(input.dialect, tables)}\n\n${renderedTables}\n\nexport const pluginSchema = {\n${schemaEntries.join("\n")}\n};\n`;
};
