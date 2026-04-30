import type z from "zod";
import type {
  namespaceSchemaDeclarationSchema,
  pluginSchemaDeclarationSchema,
  schemaColumnDeclarationSchema,
  schemaColumnTypeSchema,
  schemaDialectSchema,
  schemaRelationDeclarationSchema,
} from "./models";

export type SchemaDialect = z.infer<typeof schemaDialectSchema>;
export type SchemaColumnType = z.infer<typeof schemaColumnTypeSchema>;
export type SchemaColumnDeclaration = z.infer<
  typeof schemaColumnDeclarationSchema
>;
export type SchemaRelationDeclaration = z.infer<
  typeof schemaRelationDeclarationSchema
>;

export interface SchemaTableDeclaration {
  columns: readonly SchemaColumnDeclaration[];
  relations?: readonly SchemaRelationDeclaration[];
  tableName: string;
}

export interface NamespaceSchemaDeclaration {
  namespace: z.infer<typeof namespaceSchemaDeclarationSchema>["namespace"];
  tables: readonly SchemaTableDeclaration[];
}

export interface PluginSchemaDeclaration {
  pluginName: z.infer<typeof pluginSchemaDeclarationSchema>["pluginName"];
  tables: readonly SchemaTableDeclaration[];
}
