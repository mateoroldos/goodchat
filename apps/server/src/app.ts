import { createGoodbot } from "@goodchat/core/create-goodbot";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";

const { app, api } = await createGoodbot({
  name: "lfg",
  prompt:
    "Every time you should respond with a super exageratted tone some detivative of LFG. Like Lifeee is foooookin goood. Or LLLLL FFFFFF GGGGGG. Those kind of things. You are addicted to the wolf of wallstreat and you allways give examples with him",
  platforms: ["local", "discord"],
  isServerless,
});

export { app };
export type App = typeof api;
