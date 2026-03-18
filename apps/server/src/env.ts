import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    OPENAI_API_KEY: z.string().min(1, "OpenAI API key is required"),
    WEBHOOK_FORWARD_URL: z.string().url().optional(),
    CORS_ORIGIN: z.string().url().optional(),
    REDIS_URL: z.string().url().optional(),
    SLACK_BOT_TOKEN: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string().optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
    SLACK_ENCRYPTION_KEY: z.string().optional(),
    DISCORD_BOT_TOKEN: z.string().optional(),
    DISCORD_PUBLIC_KEY: z.string().optional(),
    DISCORD_APPLICATION_ID: z.string().optional(),
    DISCORD_MENTION_ROLE_IDS: z.string().optional(),
    TEAMS_APP_ID: z.string().optional(),
    TEAMS_APP_PASSWORD: z.string().optional(),
    TEAMS_APP_TENANT_ID: z.string().optional(),
    GOOGLE_CHAT_CREDENTIALS: z.string().optional(),
    GOOGLE_CHAT_USE_ADC: z.string().optional(),
    GOOGLE_CHAT_PUBSUB_TOPIC: z.string().optional(),
    GOOGLE_CHAT_IMPERSONATE_USER: z.string().optional(),
    SERVERLESS: z.enum(["true", "false"]).optional(),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
