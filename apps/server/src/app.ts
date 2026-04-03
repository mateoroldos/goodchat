import { sqlite } from "@goodchat/adapter-sqlite";
import { createGoodchat } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";
const databasePath = process.env.GOODCHAT_DB_PATH ?? "goodchat.sqlite";

const { app } = await createGoodchat({
  name: "Walter",
  prompt: "You are my project assistant. You help me manage my linear tasks.",
  platforms: ["local", "discord"],
  plugins: [linear({ team: "EME" })],
  model: "openai:gpt-4.1-nano",
  database: sqlite({ path: databasePath }),
  isServerless,
});

export { app };
