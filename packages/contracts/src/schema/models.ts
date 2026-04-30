import z from "zod";

export const schemaDialectSchema = z.enum(["sqlite", "postgres", "mysql"]);

export const schemaColumnTypeSchema = z.enum([
  "id",
  "text",
  "integer",
  "boolean",
  "json",
  "timestamp",
]);

export const schemaColumnDeclarationSchema = z.object({
  columnName: z.string().min(1),
  dataType: schemaColumnTypeSchema,
  notNull: z.boolean().optional(),
  primaryKey: z.boolean().optional(),
  propertyName: z.string().min(1).optional(),
  unique: z.boolean().optional(),
});

export const schemaRelationDeclarationSchema = z.object({
  fields: z.array(z.string().min(1)).optional(),
  kind: z.enum(["one", "many"]),
  name: z.string().min(1),
  references: z.array(z.string().min(1)).optional(),
  targetTable: z.string().min(1),
});

export const schemaTableDeclarationSchema = z.object({
  columns: z.array(schemaColumnDeclarationSchema),
  relations: z.array(schemaRelationDeclarationSchema).optional(),
  tableName: z.string().min(1),
});

export const namespaceSchemaDeclarationSchema = z.object({
  namespace: z.enum(["core", "auth", "plugin"]),
  tables: z.array(schemaTableDeclarationSchema),
});

export const pluginSchemaDeclarationSchema = z.object({
  pluginName: z.string().min(1),
  tables: z.array(schemaTableDeclarationSchema),
});
