import type {
  SchemaColumnDeclaration,
  SchemaColumnType,
  SchemaDialect,
} from "@goodchat/contracts/schema/types";

const DIALECT_COLUMN_FACTORY = {
  mysql: {
    id: 'varchar("%s", { length: 191 })',
    text: 'text("%s")',
    integer: 'int("%s")',
    json: 'json("%s")',
    timestamp: 'timestamp("%s")',
    boolean: 'boolean("%s")',
  },
  postgres: {
    id: 'text("%s")',
    text: 'text("%s")',
    integer: 'integer("%s")',
    json: 'jsonb("%s")',
    timestamp: 'timestamp("%s")',
    boolean: 'boolean("%s")',
  },
  sqlite: {
    id: 'text("%s")',
    text: 'text("%s")',
    integer: 'integer("%s")',
    json: 'text("%s", { mode: "json" })',
    timestamp: 'integer("%s", { mode: "timestamp" })',
    boolean: 'integer("%s", { mode: "boolean" })',
  },
} as const satisfies Record<SchemaDialect, Record<SchemaColumnType, string>>;

export const toVariableName = (tableName: string): string => {
  return tableName.replace(/_([a-z])/g, (_, char: string) =>
    char.toUpperCase()
  );
};

export const toPropertyName = (column: SchemaColumnDeclaration): string => {
  if (column.propertyName) {
    return column.propertyName;
  }
  return column.columnName.replace(/_([a-z])/g, (_, char: string) =>
    char.toUpperCase()
  );
};

export const renderScalarExpression = (input: {
  columnName: string;
  dataType: SchemaColumnType;
  dialect: SchemaDialect;
  propertyName: string;
}): string => {
  const format = DIALECT_COLUMN_FACTORY[input.dialect][input.dataType];
  return `${input.propertyName}: ${format.replace("%s", input.columnName)}`;
};
