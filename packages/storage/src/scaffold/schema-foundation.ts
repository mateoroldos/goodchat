import {
  AUTH_SCHEMA_TABLES_BY_DIALECT,
  CORE_SCHEMA_TABLES,
} from "@goodchat/contracts/schema/declarations";
import type {
  PluginSchemaDeclaration,
  SchemaColumnDeclaration,
  SchemaDialect,
  SchemaIndexDeclaration,
  SchemaTableDeclaration,
} from "@goodchat/contracts/schema/types";
import {
  renderScalarExpression,
  toPropertyName,
  toVariableName,
} from "../schema-declaration/shared";

export type Dialect = SchemaDialect;

const DIALECT_IMPORT_SOURCES = {
  mysql: "drizzle-orm/mysql-core",
  postgres: "drizzle-orm/pg-core",
  sqlite: "drizzle-orm/sqlite-core",
} as const satisfies Record<Dialect, string>;

const TABLE_FACTORY_IMPORTS = {
  mysql: "mysqlTable",
  postgres: "pgTable",
  sqlite: "sqliteTable",
} as const satisfies Record<Dialect, string>;

const DIALECT_COLUMN_IMPORTS = {
  mysql: {
    boolean: "boolean",
    id: "varchar",
    integer: "int",
    json: "json",
    text: "text",
    timestamp: "timestamp",
  },
  postgres: {
    boolean: "boolean",
    id: "text",
    integer: "integer",
    json: "jsonb",
    text: "text",
    timestamp: "timestamp",
  },
  sqlite: {
    boolean: "integer",
    id: "text",
    integer: "integer",
    json: "text",
    text: "text",
    timestamp: "integer",
  },
} as const satisfies Record<
  Dialect,
  Record<SchemaColumnDeclaration["dataType"], string>
>;

const RELATIONS_IMPORT = 'import { relations } from "drizzle-orm";';

const CORE_SCHEMA_EXPORT = {
  mysql: "mysqlSchema",
  postgres: "postgresSchema",
  sqlite: "sqliteSchema",
} as const satisfies Record<Dialect, string>;

export const renderColumn = (
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

export const renderIndexes = (
  tableVariable: string,
  indexes: readonly SchemaIndexDeclaration[]
): string => {
  return indexes
    .map((idx) => {
      const fn = idx.unique ? "uniqueIndex" : "index";
      const cols = idx.columns.map((col) => `t.${col}`).join(", ");
      const name = idx.name ?? `idx_${tableVariable}_${idx.columns.join("_")}`;
      return `  ${fn}("${name}").on(${cols}),`;
    })
    .join("\n");
};

export const renderRelations = (table: SchemaTableDeclaration): string => {
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

export const renderTables = (
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
      const varName = toVariableName(table.tableName);
      const columns = table.columns
        .map((column) => `  ${renderColumn(dialect, column)},`)
        .join("\n");
      if (table.indexes && table.indexes.length > 0) {
        const indexes = renderIndexes(varName, table.indexes);
        return `export const ${varName} = ${tableFactory}("${table.tableName}", {\n${columns}\n}, (t) => [\n${indexes}\n]);`;
      }
      return `export const ${varName} = ${tableFactory}("${table.tableName}", {\n${columns}\n});`;
    })
    .join("\n\n");
  const relationDefs = tables.map((table) => renderRelations(table)).join("\n");
  return `${tableDefs}${relationDefs}`;
};

const buildImports = (
  dialect: Dialect,
  tables: readonly SchemaTableDeclaration[]
): string => {
  const coreImports = new Set<string>([TABLE_FACTORY_IMPORTS[dialect]]);
  let hasRelations = false;

  for (const table of tables) {
    for (const column of table.columns) {
      coreImports.add(DIALECT_COLUMN_IMPORTS[dialect][column.dataType]);
    }
    for (const indexDeclaration of table.indexes ?? []) {
      coreImports.add(indexDeclaration.unique ? "uniqueIndex" : "index");
    }
    if (table.relations && table.relations.length > 0) {
      hasRelations = true;
    }
  }

  const dialectImport = `import { ${[...coreImports].sort().join(", ")} } from "${DIALECT_IMPORT_SOURCES[dialect]}";`;
  return hasRelations ? `${dialectImport}\n${RELATIONS_IMPORT}` : dialectImport;
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
