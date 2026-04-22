import { createGoodchat, openai } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";
import { sqlite } from "@goodchat/storage/sqlite";
import { schema } from "./db/schema";
import { env } from "./env";

export const goodchat = createGoodchat({
  name: "Minimal",
  prompt: "You are a helpful assistant",
  platforms: ["web", "discord", "slack", "gchat", "linear", "github", "teams"],
  model: openai("gpt-4.1-mini"),
  dashboard: true,
  auth: {
    enabled: env.ENVIRONMENT !== "development",
    password: env.GOODCHAT_DASHBOARD_PASSWORD,
  },
  plugins: [linear({ team: "EME" })],
  database: sqlite({
    path: env.DATABASE_URL,
    schema,
  }),
});
