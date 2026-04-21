import type { DrainContext } from "evlog";
import z from "zod";
import { mcpServerSchema, toolSchema } from "../capabilities/models";
import type { Database } from "../database/interface";
import { goodchatHooksSchema } from "../hooks/models";
import { modelRefSchema } from "../model/model-ref";
import {
  goodchatPluginDefinitionSchema,
  goodchatPluginFactorySchema,
  goodchatPluginSchema,
} from "../plugins/models";

export const CHAT_PLATFORMS = [
  "web",
  "slack",
  "discord",
  "teams",
  "gchat",
  "linear",
  "github",
] as const;

export const platformSchema = z.enum(CHAT_PLATFORMS);

export const DATABASE_DIALECTS = ["sqlite", "postgres", "mysql"] as const;

export const databaseDialectSchema = z.enum(DATABASE_DIALECTS);

export const AUTH_MODES = ["password"] as const;

export const authModeSchema = z.enum(AUTH_MODES);

export const loggingSchema = z.object({
  enabled: z.boolean().default(true),
  service: z.string().optional(),
  drain: z.custom<(ctx: DrainContext) => void | Promise<void>>().optional(),
});

export const authConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    mode: authModeSchema.default("password"),
    webChatPublic: z.boolean().default(false),
    password: z.string().min(1).optional(),
  })
  .default({
    enabled: false,
    mode: "password",
    webChatPublic: false,
  })
  .superRefine((value, context) => {
    if (!value.enabled) {
      return;
    }

    if (!value.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Auth password is required when auth is enabled",
      });
    }
  });

const corsOriginSchema = z.custom<string | ((request: Request) => boolean)>(
  (value) => typeof value === "string" || typeof value === "function",
  {
    message: "CORS origin must be a string or function",
  }
);

export const botConfigSchema = z.object({
  id: z.string().min(1, "Bot id is required").optional(),
  name: z.string().min(1, "Bot name is required"),
  prompt: z.string().min(1, "Bot prompt is required"),
  platforms: z.array(platformSchema).min(1, "Platform is required"),
  model: modelRefSchema,
  logging: loggingSchema.default({ enabled: true }),
  corsOrigin: corsOriginSchema.optional(),
  hooks: goodchatHooksSchema.optional(),
  isServerless: z.boolean().default(false),
  mcp: z.array(mcpServerSchema).default([]),
  database: z.custom<Database>(
    (value) => {
      if (typeof value !== "object" || value === null) {
        return false;
      }

      const database = value as { dialect?: unknown };
      return databaseDialectSchema.safeParse(database.dialect).success;
    },
    {
      message: "Database must include a valid dialect",
    }
  ),
  plugins: z
    .array(
      z.union([
        goodchatPluginDefinitionSchema,
        goodchatPluginFactorySchema,
        goodchatPluginSchema,
      ])
    )
    .default([]),
  tools: z.record(z.string(), toolSchema).default({}),
  dashboard: z.boolean().default(true),
  auth: authConfigSchema,
});
