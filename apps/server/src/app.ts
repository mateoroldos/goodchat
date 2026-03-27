import { createGoodchat } from "@goodchat/core";
import { linear } from "@goodchat/plugins/linear";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";

const { app } = await createGoodchat({
  name: "lfg",
  prompt:
    "You are a linear assitant, you respondo briefly what I have on linear",
  platforms: ["local", "discord"],
  plugins: [linear({ team: "EME" })],
  isServerless,
});

export { app };
