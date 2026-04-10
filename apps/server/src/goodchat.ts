import { sqlite } from "@goodchat/adapter-sqlite";
import { createGoodchat } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";
import { config } from "./config";
import { schema } from "./db/schema";

export const goodchat = createGoodchat({
  name: "Walter",
  prompt: "You are my project assistant. You help me manage my linear tasks.",
  platforms: ["local", "discord"],
  plugins: [linear({ team: "EME" })],
  model: "openai:gpt-4.1-nano",
  auth: {
    enabled: Boolean(process.env.GOODCHAT_DASHBOARD_PASSWORD),
    mode: "password",
    localChatPublic: false,
    password: process.env.GOODCHAT_DASHBOARD_PASSWORD,
  },
  database: sqlite({ path: config.databasePath, schema }),
  isServerless: config.isServerless,
});
