import z from "zod";
import { mcpServerSchema, toolSchema } from "../capabilities/models";
import { goodbotHooksSchema } from "../hooks/models";
import type { GoodbotPluginDefinition } from "./types";

const zodSchemaSchema = z.custom<z.ZodObject<z.ZodRawShape>>(
  (value) =>
    value !== null && typeof value === "object" && "safeParse" in value,
  {
    message: "Expected a zod schema",
  }
);

export const goodbotPluginSchema = z.object({
  hooks: goodbotHooksSchema.optional(),
  mcp: z.array(mcpServerSchema).optional(),
  name: z.string().min(1, "Plugin name is required"),
  systemPrompt: z.string().optional(),
  tools: z.record(z.string(), toolSchema).optional(),
});

export const goodbotPluginDefinitionSchema = z.object({
  create: z.custom<GoodbotPluginDefinition["create"]>(
    (value) => typeof value === "function",
    {
      message: "Expected a function",
    }
  ),
  env: zodSchemaSchema.optional(),
  name: z.string().min(1, "Plugin name is required"),
});

export type GoodbotPluginSchemaInput = z.infer<typeof goodbotPluginSchema>;
