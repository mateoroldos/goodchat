import { sqlite } from "@goodchat/adapter-sqlite";
import { createGoodchat } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";
import { config } from "./config";

const { app } = await createGoodchat({
  name: "Walter",
  prompt: "You are my project assistant. You help me manage my linear tasks.",
  platforms: ["local", "discord"],
  plugins: [linear({ team: "EME" })],
  model: "openai:gpt-4.1-nano",
  database: sqlite({ path: config.databasePath }),
  isServerless: config.isServerless,
});

export { app };
