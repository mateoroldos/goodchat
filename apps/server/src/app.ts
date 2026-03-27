import { createGoodchat } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";

const { app } = await createGoodchat({
  name: "Walter",
  prompt: "You are my project assistan. You help me manage my linear tasks.",
  platforms: ["local", "discord"],
  plugins: [linear({ team: "EME" })],
  model: "openai:gpt-4.1-nano",
  isServerless,
});

export { app };
