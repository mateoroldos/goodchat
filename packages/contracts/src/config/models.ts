import z from "zod";
import { modelRefSchema } from "../model/model-ref";

export const CHAT_PLATFORMS = [
  "local",
  "slack",
  "discord",
  "teams",
  "gchat",
] as const;

export const platformSchema = z.enum(CHAT_PLATFORMS);

export const DATABASE_DIALECTS = ["sqlite", "postgres", "mysql"] as const;

export const databaseDialectSchema = z.enum(DATABASE_DIALECTS);

export const AUTH_MODES = ["password"] as const;

export const authModeSchema = z.enum(AUTH_MODES);

export const authConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    mode: authModeSchema.default("password"),
    localChatPublic: z.boolean().default(false),
    password: z.string().min(1).optional(),
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

export const botConfigSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  prompt: z.string().min(1, "Bot prompt is required"),
  platforms: z.array(platformSchema).min(1, "Platform is required"),
  model: modelRefSchema.optional(),
});
