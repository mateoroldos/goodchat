import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    GOODCHAT_DASHBOARD_PASSWORD: z.string().min(1, "Dashboard password is required"),
    GOODCHAT_AUTH_SECRET: z.string().min(1, "GOODCHAT_AUTH_SECRET is required"),
    CRON_SECRET: z.string().optional(),
    ENVIRONMENT: z.enum(["development", "test", "production"]).optional(),
    OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_PUBLIC_KEY: z.string().optional(),
    DISCORD_APPLICATION_ID: z.string().optional(),
    DISCORD_MENTION_ROLE_IDS: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
