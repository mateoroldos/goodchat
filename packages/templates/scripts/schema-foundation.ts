import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export type Dialect = "sqlite" | "postgres" | "mysql";

const BETTER_AUTH_CLI_VERSION = "1.3.4";
const PACKAGE_ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIALECT_AUTH_CONFIG_PATH = {
  sqlite: "scripts/auth-schema/sqlite-auth.config.js",
  postgres: "scripts/auth-schema/postgres-auth.config.js",
  mysql: "scripts/auth-schema/mysql-auth.config.js",
} as const satisfies Record<Dialect, string>;

export interface CoreColumnDefinition {
  propertyName?: string;
  columnName: string;
  dataType: "id" | "text" | "integer" | "boolean" | "json";
  notNull?: boolean;
  primaryKey?: boolean;
}

export interface CoreTableDefinition {
  tableName: string;
  columns: readonly CoreColumnDefinition[];
}

export const CORE_SCHEMA_DSL: readonly CoreTableDefinition[] = [
  {
    tableName: "threads",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "bot_id", dataType: "text", notNull: true },
      { columnName: "bot_name", dataType: "text", notNull: true },
      { columnName: "platform", dataType: "text", notNull: true },
      { columnName: "adapter_name", dataType: "text", notNull: true },
      { columnName: "thread_id", dataType: "text", notNull: true },
      { columnName: "user_id", dataType: "text", notNull: true },
      { columnName: "text", dataType: "text", notNull: true },
      { columnName: "response_text", dataType: "text", notNull: true },
      { columnName: "created_at", dataType: "text", notNull: true },
      { columnName: "updated_at", dataType: "text", notNull: true },
      { columnName: "last_activity_at", dataType: "text", notNull: true },
    ],
  },
  {
    tableName: "messages",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "thread_id", dataType: "text", notNull: true },
      { columnName: "role", dataType: "text" },
      { columnName: "text", dataType: "text", notNull: true },
      { columnName: "created_at", dataType: "text", notNull: true },
      { columnName: "metadata", dataType: "json" },
      { columnName: "user_id", dataType: "text", notNull: true },
      { columnName: "adapter_name", dataType: "text", notNull: true },
    ],
  },
  {
    tableName: "ai_runs",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "thread_id", dataType: "text", notNull: true },
      { columnName: "assistant_message_id", dataType: "text", notNull: true },
      { columnName: "user_id", dataType: "text", notNull: true },
      { columnName: "mode", dataType: "text", notNull: true },
      { columnName: "provider", dataType: "text", notNull: true },
      { columnName: "model_id", dataType: "text", notNull: true },
      { columnName: "finish_reason", dataType: "text" },
      { columnName: "had_error", dataType: "boolean", notNull: true },
      { columnName: "error_code", dataType: "text" },
      { columnName: "error_message", dataType: "text" },
      { columnName: "input_tokens", dataType: "integer" },
      { columnName: "output_tokens", dataType: "integer" },
      { columnName: "total_tokens", dataType: "integer" },
      { columnName: "duration_ms", dataType: "integer" },
      { columnName: "usage", dataType: "json" },
      { columnName: "provider_metadata", dataType: "json" },
      { columnName: "created_at", dataType: "text", notNull: true },
      { columnName: "finished_at", dataType: "text" },
    ],
  },
  {
    tableName: "ai_run_tool_calls",
    columns: [
      { columnName: "id", dataType: "id", primaryKey: true },
      { columnName: "ai_run_id", dataType: "text", notNull: true },
      { columnName: "tool_call_id", dataType: "text" },
      { columnName: "tool_name", dataType: "text", notNull: true },
      { columnName: "status", dataType: "text", notNull: true },
      { columnName: "duration_ms", dataType: "integer" },
      { columnName: "input", dataType: "json" },
      { columnName: "output", dataType: "json" },
      { columnName: "error", dataType: "json" },
      { columnName: "created_at", dataType: "text", notNull: true },
    ],
  },
] as const;

const AUTH_SCHEMA_EXPORT_BLOCK = `

export const authSchema = {
  user,
  session,
  account,
  verification,
};
`;

const UNUSED_POSTGRES_INTEGER_IMPORT_REGEX = /,\s*integer\s*,/;
const UNUSED_MYSQL_INT_IMPORT_REGEX = /,\s*int\s*,/;

export const normalizeBetterAuthSchemaText = (
  dialect: Dialect,
  source: string
): string => {
  let content = source;

  if (dialect === "postgres") {
    content = content.replace(UNUSED_POSTGRES_INTEGER_IMPORT_REGEX, ",");
  }

  if (dialect === "mysql") {
    content = content.replace(UNUSED_MYSQL_INT_IMPORT_REGEX, ",");
  }

  const trimmed = content.trimEnd();
  if (trimmed.includes("export const authSchema")) {
    return `${trimmed}\n`;
  }

  return `${trimmed}${AUTH_SCHEMA_EXPORT_BLOCK}`;
};

const DIALECT_IMPORTS = {
  mysql:
    'import {\n  boolean,\n  int,\n  json,\n  mysqlTable,\n  text,\n  varchar,\n} from "drizzle-orm/mysql-core";',
  postgres:
    'import { boolean, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core";',
  sqlite:
    'import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";',
} as const satisfies Record<Dialect, string>;

const DIALECT_SCHEMA_EXPORT = {
  mysql: "mysqlSchema",
  postgres: "postgresSchema",
  sqlite: "sqliteSchema",
} as const satisfies Record<Dialect, string>;

const CORE_SCHEMA_EXPORT_ORDER = [
  "ai_runs",
  "ai_run_tool_calls",
  "threads",
  "messages",
] as const;

const toVariableName = (tableName: string): string => {
  return tableName.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
};

const toPropertyName = (column: CoreColumnDefinition): string => {
  if (column.propertyName) {
    return column.propertyName;
  }
  return column.columnName.replace(/_([a-z])/g, (_, char: string) =>
    char.toUpperCase()
  );
};

const renderColumnExpression = (input: {
  column: CoreColumnDefinition;
  dialect: Dialect;
}): string => {
  const { column, dialect } = input;

  const baseType = (() => {
    if (column.dataType === "id") {
      if (dialect === "mysql") {
        return `${toPropertyName(column)}: varchar("${column.columnName}", { length: 191 })`;
      }
      return `${toPropertyName(column)}: text("${column.columnName}")`;
    }
    if (column.dataType === "text") {
      return `${toPropertyName(column)}: text("${column.columnName}")`;
    }
    if (column.dataType === "integer") {
      return `${toPropertyName(column)}: ${dialect === "mysql" ? "int" : "integer"}("${column.columnName}")`;
    }
    if (column.dataType === "boolean") {
      if (dialect === "sqlite") {
        return `${toPropertyName(column)}: integer("${column.columnName}", { mode: "boolean" })`;
      }
      return `${toPropertyName(column)}: boolean("${column.columnName}")`;
    }
    if (dialect === "sqlite") {
      return `${toPropertyName(column)}: text("${column.columnName}", { mode: "json" })`;
    }
    return `${toPropertyName(column)}: ${dialect === "mysql" ? "json" : "jsonb"}("${column.columnName}")`;
  })();

  let expression = baseType;
  if (column.primaryKey) {
    expression = `${expression}.primaryKey()`;
  }
  if (column.notNull) {
    expression = `${expression}.notNull()`;
  }

  return expression;
};

const renderTableExpression = (input: {
  dialect: Dialect;
  table: CoreTableDefinition;
}): string => {
  const { dialect, table } = input;
  const variableName = toVariableName(table.tableName);
  const tableFactory =
    dialect === "sqlite"
      ? "sqliteTable"
      : dialect === "postgres"
        ? "pgTable"
        : "mysqlTable";
  const renderedColumns = table.columns
    .map((column) => `  ${renderColumnExpression({ column, dialect })},`)
    .join("\n");

  return `export const ${variableName} = ${tableFactory}("${table.tableName}", {\n${renderedColumns}\n});`;
};

export const emitCoreDrizzleSchema = (dialect: Dialect): string => {
  const renderedTables = CORE_SCHEMA_DSL.map((table) =>
    renderTableExpression({ dialect, table })
  ).join("\n\n");
  const schemaEntries = CORE_SCHEMA_EXPORT_ORDER.map((tableName) =>
    toVariableName(tableName)
  )
    .map((tableVariable) => `  ${tableVariable},`)
    .join("\n");

  return `${DIALECT_IMPORTS[dialect]}\n\n${renderedTables}\n\nexport const ${DIALECT_SCHEMA_EXPORT[dialect]} = {\n${schemaEntries}\n};\n`;
};

export const normalizeAuthModelFromBetterAuthImport = (input: {
  dialect: Dialect;
  source: string;
}): string => {
  return normalizeBetterAuthSchemaText(input.dialect, input.source);
};

const runBunCommand = async (args: string[]): Promise<void> => {
  const child = spawn("bun", args, {
    cwd: PACKAGE_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  child.stdout.on("data", (chunk) => stdoutChunks.push(String(chunk)));
  child.stderr.on("data", (chunk) => stderrChunks.push(String(chunk)));
  const exitCode = await new Promise<number>((resolvePromise) => {
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
  const stdout = stdoutChunks.join("");
  const stderr = stderrChunks.join("");
  if (exitCode === 0) {
    return;
  }
  throw new Error(
    [stdout.trim(), stderr.trim()].filter((line) => line.length > 0).join("\n")
  );
};

const importBetterAuthSchema = async (dialect: Dialect): Promise<string> => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "goodchat-auth-import-"));
  const outputPath = join(tempDirectory, `${dialect}.ts`);

  try {
    await runBunCommand([
      "x",
      `@better-auth/cli@${BETTER_AUTH_CLI_VERSION}`,
      "generate",
      "--yes",
      "--config",
      DIALECT_AUTH_CONFIG_PATH[dialect],
      "--output",
      outputPath,
    ]);
    return readFile(outputPath, "utf8");
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
};

export const emitAuthDrizzleSchemaFromBetterAuthImport = async (
  dialect: Dialect
): Promise<string> => {
  let source: string;
  try {
    source = await importBetterAuthSchema(dialect);
  } catch {
    source = await readFile(
      resolve(PACKAGE_ROOT, "../storage", `schema/auth/${dialect}.ts`),
      "utf8"
    );
  }
  return normalizeAuthModelFromBetterAuthImport({ dialect, source });
};
