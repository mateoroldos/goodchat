import { createGoodchat, openai } from "@goodchat/core";
import { schema } from "./db/schema.js";
import { env } from "./env.js";
import { postgres } from "@goodchat/storage/postgres";

export const goodchat = createGoodchat({
  name: "Vercel",
  prompt: "You are a maintainer: write clean code others patch on Friday.",
  platforms: ["web", "discord"],
  model: openai("gpt-5.4-nano"),
  auth: {
    enabled: env.ENVIRONMENT !== "development",
    password: env.GOODCHAT_DASHBOARD_PASSWORD,
  },
  database: postgres({
    connectionString: env.DATABASE_URL,
    driver: "@neondatabase/serverless",
    schema,
  }),
  isServerless: true,
});
