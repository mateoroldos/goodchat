import { CORE_SCHEMA_TABLES } from "@goodchat/contracts/schema/declarations";
import { mysqlSchema } from "../src/internal-schema/mysql.ts";
import { postgresSchema } from "../src/internal-schema/postgres.ts";
import { sqliteSchema } from "../src/internal-schema/sqlite.ts";

const toPropertyName = (column) => {
  if (column.propertyName) {
    return column.propertyName;
  }
  return column.columnName.replace(/_([a-z])/g, (_, char) =>
    char.toUpperCase()
  );
};

const toRuntimeTableName = (tableName) => {
  return tableName.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
};

const schemas = {
  mysql: mysqlSchema,
  postgres: postgresSchema,
  sqlite: sqliteSchema,
};

const errors = [];

for (const [dialect, schema] of Object.entries(schemas)) {
  for (const table of CORE_SCHEMA_TABLES) {
    const runtimeTableName = toRuntimeTableName(table.tableName);
    const schemaTable = schema[runtimeTableName];
    if (!schemaTable) {
      errors.push(`${dialect}: missing table '${runtimeTableName}'`);
      continue;
    }

    for (const column of table.columns) {
      const runtimeColumnName = toPropertyName(column);
      if (!(runtimeColumnName in schemaTable)) {
        errors.push(
          `${dialect}.${runtimeTableName}: missing column '${runtimeColumnName}'`
        );
      }
    }
  }
}

if (errors.length > 0) {
  throw new Error(
    `Core schema out of sync with declarations:\n${errors.join("\n")}`
  );
}

console.log("Core schemas are in sync with declarations.");
