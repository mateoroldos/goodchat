import { createGoodbot } from "@goodbot/core";
import { linear } from "@goodbot/plugins/linear";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";

const { app, api } = await createGoodbot({
  name: "lfg",
  prompt:
    "You are a linear assitant, you respondo briefly what I have on linear",
  platforms: ["local", "discord"],
  plugins: [linear],
  isServerless,
});

export { app };
export type App = typeof api;
