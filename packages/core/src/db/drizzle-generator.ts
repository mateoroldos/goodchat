import type {
  FieldDef,
  FieldType,
  GoodchatSchema,
} from "@goodchat/contracts/db/types";

export type Dialect = "sqlite" | "postgres" | "mysql";

const toSnakeCase = (s: string) =>
  s.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`);

const columnName = (logicalKey: string, def: FieldDef) =>
  def.columnName ?? toSnakeCase(logicalKey);

const fieldToColumn = (
  col: string,
  def: FieldDef,
  dialect: Dialect
): string => {
  const name = columnName(col, def);
  const type = fieldTypeToBuilder(name, def.type, dialect);
  const notNull = def.required === false ? "" : ".notNull()";
  const unique = def.unique ? ".unique()" : "";
  const ref = def.references
    ? `.references(() => ${toCamelCase(def.references.model)}.${toCamelCase(def.references.field)}, { onDelete: "${def.references.onDelete ?? "cascade"}" })`
    : "";
  const dflt = renderDefault(def, dialect);
  return `  ${col}: ${type}${dflt}${notNull}${unique}${ref},`;
};

const toCamelCase = (s: string) =>
  s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const fieldTypeToBuilder = (
  name: string,
  type: FieldType,
  dialect: Dialect
): string => {
  if (dialect === "sqlite") {
    const map: Record<FieldType, string> = {
      string: `text("${name}")`,
      number: `integer("${name}")`,
      boolean: `integer("${name}", { mode: "boolean" })`,
      date: `integer("${name}", { mode: "timestamp_ms" })`,
      json: `text("${name}", { mode: "json" })`,
    };
    return map[type];
  }
  if (dialect === "postgres") {
    const map: Record<FieldType, string> = {
      string: `text("${name}")`,
      number: `integer("${name}")`,
      boolean: `boolean("${name}")`,
      date: `timestamp("${name}")`,
      json: `jsonb("${name}")`,
    };
    return map[type];
  }
  // mysql
  const map: Record<FieldType, string> = {
    string: `text("${name}")`,
    number: `int("${name}")`,
    boolean: `boolean("${name}")`,
    date: `timestamp("${name}")`,
    json: `json("${name}")`,
  };
  return map[type];
};

const renderDefault = (def: FieldDef, _dialect: Dialect): string => {
  if (def.default === undefined) {
    return "";
  }
  if (typeof def.default === "function") {
    return `.$defaultFn(${def.default.toString()})`;
  }
  if (typeof def.default === "string") {
    return `.default(${JSON.stringify(def.default)})`;
  }
  return `.default(${def.default})`;
};

const primaryKeyBuilder = (dialect: Dialect): string => {
  if (dialect === "mysql") {
    return `varchar("id", { length: 191 }).primaryKey()`;
  }
  return `text("id").primaryKey()`;
};

const tableBuilder = (dialect: Dialect): string => {
  if (dialect === "sqlite") {
    return "sqliteTable";
  }
  if (dialect === "postgres") {
    return "pgTable";
  }
  return "mysqlTable";
};

const renderImports = (schema: GoodchatSchema, dialect: Dialect): string => {
  const hasBoolean = Object.values(schema).some((t) =>
    Object.values(t.columns).some((f) => f.type === "boolean")
  );
  const hasNumber = Object.values(schema).some((t) =>
    Object.values(t.columns).some((f) => f.type === "number")
  );
  const hasJson = Object.values(schema).some((t) =>
    Object.values(t.columns).some((f) => f.type === "json")
  );
  const hasDate = Object.values(schema).some((t) =>
    Object.values(t.columns).some((f) => f.type === "date")
  );

  if (dialect === "sqlite") {
    const imports = ["sqliteTable", "text"];
    if (hasNumber || hasBoolean || hasDate) {
      imports.push("integer");
    }
    return `import { ${imports.join(", ")} } from "drizzle-orm/sqlite-core";\n`;
  }
  if (dialect === "postgres") {
    const imports = ["pgTable", "text"];
    if (hasNumber) {
      imports.push("integer");
    }
    if (hasBoolean) {
      imports.push("boolean");
    }
    if (hasDate) {
      imports.push("timestamp");
    }
    if (hasJson) {
      imports.push("jsonb");
    }
    return `import { ${imports.join(", ")} } from "drizzle-orm/pg-core";\n`;
  }
  // mysql
  const imports = ["mysqlTable", "text", "varchar"];
  if (hasNumber) {
    imports.push("int");
  }
  if (hasBoolean) {
    imports.push("boolean");
  }
  if (hasDate) {
    imports.push("timestamp");
  }
  if (hasJson) {
    imports.push("json");
  }
  return `import { ${imports.join(", ")} } from "drizzle-orm/mysql-core";\n`;
};

export const generateDrizzleSchema = (
  schema: GoodchatSchema,
  dialect: Dialect,
  schemaExportName = "schema",
  includeImports = true
): string => {
  const tables = Object.entries(schema).sort(
    ([, a], [, b]) =>
      (a.order ?? Number.POSITIVE_INFINITY) -
      (b.order ?? Number.POSITIVE_INFINITY)
  );

  const tableNames = tables.map(([key]) => key);
  const builder = tableBuilder(dialect);

  const tableBlocks = tables
    .map(([key, def]) => {
      const name = def.tableName ?? toSnakeCase(key);
      const cols = Object.entries(def.columns)
        .filter(([col]) => col !== "id")
        .map(([col, colDef]) => fieldToColumn(col, colDef, dialect))
        .join("\n");
      return `export const ${key} = ${builder}("${name}", {\n  id: ${primaryKeyBuilder(dialect)},\n${cols}\n});`;
    })
    .join("\n\n");

  const schemaExport = `export const ${schemaExportName} = {\n  ${tableNames.join(",\n  ")},\n};`;

  const imports = includeImports ? `${renderImports(schema, dialect)}\n` : "";
  return `${imports}${tableBlocks}\n\n${schemaExport}\n`;
};
