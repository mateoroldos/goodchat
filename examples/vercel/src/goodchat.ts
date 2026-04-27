import { createGoodchat, openai } from "@goodchat/core";
import { schema } from "./db/schema.js";
import { env } from "./env.js";
import { postgres } from "@goodchat/storage/postgres";

export const goodchat = createGoodchat({
  name: "Pedro",
  prompt: "You are a friendly skeptic. You kill bad ideas gently and quietly adopt the good ones.",
  platforms: ["web","discord"],
  isServerless: true,
  model: openai("gpt-5.4-nano"),
  auth: {
    enabled: env.ENVIRONMENT !== "development",
    password: env.GOODCHAT_DASHBOARD_PASSWORD,
  },
  database: postgres({ connectionString: env.DATABASE_URL, driver: "@neondatabase/serverless", schema }),
});
