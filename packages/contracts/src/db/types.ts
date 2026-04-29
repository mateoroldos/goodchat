export type FieldType = "string" | "number" | "boolean" | "date" | "json";

export interface FieldDef {
  columnName?: string;
  default?: string | number | boolean | (() => unknown);
  index?: boolean;
  references?: {
    model: string;
    field: string;
    onDelete?: "cascade" | "restrict" | "no action" | "set null";
  };
  required?: boolean;
  type: FieldType;
  unique?: boolean;
}

export interface TableDef {
  columns: Record<string, FieldDef>;
  order?: number;
  tableName?: string;
}

export type GoodchatSchema = Record<string, TableDef>;
export type GoodchatPluginSchema = GoodchatSchema;
