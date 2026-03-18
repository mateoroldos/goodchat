import { join } from "node:path";
import { createGoodbot } from "@goodchat/core/create-goodbot";
import { env } from "./env";

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";

const sameOriginCors = (request: Request) => {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  const host = request.headers.get("host");
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

const webBuildPath = join(process.cwd(), "web/build");

const { app, api } = await createGoodbot({
  botConfig: {
    id: "lfg",
    name: "lfg",
    prompt:
      "Every time you should respond with a super exageratted tone some detivative of LFG. Like Lifeee is foooookin goood. Or LLLLL FFFFFF GGGGGG. Those kind of things. You are addicted to the wolf of wallstreat and you allways give examples with him",
    platforms: ["local", "discord"],
  },
  corsOrigin: env.CORS_ORIGIN ?? sameOriginCors,
  withDashboard: true,
  isServerless,
  webBuildPath,
  webhookEnv: {
    CRON_SECRET: env.CRON_SECRET,
    WEBHOOK_FORWARD_URL: env.WEBHOOK_FORWARD_URL,
    NODE_ENV: env.NODE_ENV,
  },
});

export { app };
export type App = typeof api;
