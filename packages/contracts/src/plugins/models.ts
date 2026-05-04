import z from "zod";
import { mcpServerSchema, toolSchema } from "../capabilities/models";
import { goodchatPluginHooksSchema } from "../hooks/models";
import { schemaTableDeclarationSchema } from "../schema/models";
import type { GoodchatPluginDefinition, GoodchatPluginFactory } from "./types";

const zodSchemaSchema = z.custom<z.ZodObject<z.ZodRawShape>>(
  (value) =>
    value !== null && typeof value === "object" && "safeParse" in value,
  {
    message: "Expected a zod schema",
  }
);

const zodTypeSchema = z.custom<z.ZodTypeAny>(
  (value) =>
    value !== null && typeof value === "object" && "safeParse" in value,
  {
    message: "Expected a zod schema",
  }
);

// Runtime plugin shape after definition/factory resolution.
// This schema validates plugins that are ready to execute in the pipeline.
export const goodchatPluginSchema = z.object({
  hooks: goodchatPluginHooksSchema.optional(),
  mcp: z.array(mcpServerSchema).optional(),
  name: z.string().min(1, "Plugin name is required"),
  systemPrompt: z.string().optional(),
  tools: z.record(z.string(), toolSchema).optional(),
});

// Definition shape before runtime instantiation.
// This schema validates plugin declarations that provide `create` (and optional env/params schemas)
// and are later turned into a runtime plugin matching `goodchatPluginSchema`.
export const goodchatPluginDefinitionSchema = z.object({
  create: z.custom<GoodchatPluginDefinition["create"]>(
    (value) => typeof value === "function",
    {
      message: "Expected a function",
    }
  ),
  env: zodSchemaSchema.optional(),
  key: z.string().min(1).optional(),
  name: z.string().min(1, "Plugin name is required"),
  params: z.unknown().optional(),
  paramsSchema: zodTypeSchema.optional(),
  schema: z.array(schemaTableDeclarationSchema).optional(),
});

export const goodchatPluginFactorySchema = z.custom<GoodchatPluginFactory>(
  (value) => typeof value === "function",
  {
    message: "Expected a plugin factory",
  }
);

export type GoodchatPluginSchemaInput = z.infer<typeof goodchatPluginSchema>;
