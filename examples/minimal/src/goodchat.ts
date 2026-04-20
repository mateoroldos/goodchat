import { createGoodchat, openai } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";
import { sqlite } from "@goodchat/storage/sqlite";
import { schema } from "./db/schema";

export const goodchat = createGoodchat({
  name: "Minimal",
  prompt: "You are a helpful assistant",
  platforms: [
    "local",
    "discord",
    "slack",
    "gchat",
    "linear",
    "github",
    "teams",
  ],
  model: openai("gpt-4.1-mini"),
  withDashboard: true,
  auth: {
    enabled: true,
    mode: "password",
    localChatPublic: false,
    password: process.env.GOODCHAT_DASHBOARD_PASSWORD,
  },
  plugins: [linear({ team: "EME" })],
  database: sqlite({
    path: process.env.DATABASE_URL || "./goodchat.db",
    schema,
  }),
  isServerless: process.env.SERVERLESS === "true" || process.env.VERCEL === "1",
});
