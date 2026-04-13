import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
export const env = createEnv({
    server: {
        DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
        GOODCHAT_DASHBOARD_PASSWORD: z
            .string()
            .min(1, "Dashboard password is required"),
        GOODCHAT_AUTH_SECRET: z.string().min(1, "GOODCHAT_AUTH_SECRET is required"),
        WEBHOOK_FORWARD_URL: z.string().url().optional(),
        REDIS_URL: z.string().url().optional(),
        CRON_SECRET: z.string().optional(),
        SERVERLESS: z.enum(["true", "false"]).optional(),
        AI_GATEWAY_API_KEY: z.string().min(1, "AI Gateway API key is required"),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
});
