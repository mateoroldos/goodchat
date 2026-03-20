import z from "zod";
import { goodbotHooksSchema, toolSchema } from "./capabilities/models";
import { botConfigSchema, mcpServerSchema } from "./config/models";
import type { MessageStoreService } from "./message-store/message-store.service.interface";
import {
  goodbotPluginDescriptorSchema,
  goodbotPluginSchema,
} from "./plugins/models";

const corsOriginSchema = z.custom<string | ((request: Request) => boolean)>(
  (value) => typeof value === "string" || typeof value === "function",
  {
    message: "CORS origin must be a string or function",
  }
);

export const goodbotOptionsSchema = botConfigSchema.extend({
  corsOrigin: corsOriginSchema.optional(),
  hooks: goodbotHooksSchema.optional(),
  id: z.string().min(1, "Bot id is required").optional(),
  isServerless: z.boolean().optional(),
  mcp: z.array(mcpServerSchema).optional(),
  messageStore: z.custom<MessageStoreService>().optional(),
  name: z.string().min(1, "Bot name is required"),
  platforms: botConfigSchema.shape.platforms,
  plugins: z
    .array(z.union([goodbotPluginDescriptorSchema, goodbotPluginSchema]))
    .optional(),
  prompt: z.string().min(1, "Bot prompt is required"),
  tools: z.record(z.string(), toolSchema).optional(),
  withDashboard: z.boolean().optional(),
});

export type GoodbotOptionsInput = z.infer<typeof goodbotOptionsSchema>;
