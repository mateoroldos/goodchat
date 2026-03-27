import z from "zod";
import { mcpServerSchema, toolSchema } from "../capabilities/models";
import { goodchatHooksSchema } from "../hooks/models";
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

export const goodchatPluginSchema = z.object({
  hooks: goodchatHooksSchema.optional(),
  mcp: z.array(mcpServerSchema).optional(),
  name: z.string().min(1, "Plugin name is required"),
  systemPrompt: z.string().optional(),
  tools: z.record(z.string(), toolSchema).optional(),
});

export const goodchatPluginDefinitionSchema = z.object({
  create: z.custom<GoodchatPluginDefinition["create"]>(
    (value) => typeof value === "function",
    {
      message: "Expected a function",
    }
  ),
  env: zodSchemaSchema.optional(),
  name: z.string().min(1, "Plugin name is required"),
  params: z.unknown().optional(),
  paramsSchema: zodTypeSchema.optional(),
});

export const goodchatPluginFactorySchema = z.custom<GoodchatPluginFactory>(
  (value) => typeof value === "function",
  {
    message: "Expected a plugin factory",
  }
);

export type GoodchatPluginSchemaInput = z.infer<typeof goodchatPluginSchema>;
