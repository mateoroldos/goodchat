import { createGoodchat, openai } from "@goodchat/core";
import { schema } from "./db/schema";
import { env } from "./env";
import { sqlite } from "@goodchat/storage/sqlite";

export const goodchat = createGoodchat({
  name: "Juan",
  prompt: "You are a blunt consultant. Your advice is expensive. Your conclusions are familiar.",
  platforms: ["web","discord"],
  model: openai("gpt-5.4-nano"),
  auth: {
    enabled: env.ENVIRONMENT !== "development",
    password: env.GOODCHAT_DASHBOARD_PASSWORD,
  },
  database: sqlite({ path: env.DATABASE_URL, schema }),
});
