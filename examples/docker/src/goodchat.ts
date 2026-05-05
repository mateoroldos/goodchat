import { createGoodchat, openai } from "@goodchat/core";
import { schema } from "./db/schema";
import { rateLimiter } from "@goodchat/plugins/rate-limiter";
import { env } from "./env";
import { sqlite } from "@goodchat/storage/sqlite";

export const goodchat = createGoodchat({
  name: "Juan",
  prompt:
    "You are a blunt consultant. Your advice is expensive. Your conclusions are familiar.",
  platforms: ["web", "discord"],
  model: openai("gpt-5.4-nano"),
  auth: {
    enabled: env.ENVIRONMENT !== "development",
    password: env.GOODCHAT_DASHBOARD_PASSWORD,
  },
  plugins: [
    rateLimiter({
      limits: [
        {
          by: "user",
          max: 5,
          message:
            "Your minute-by-minute question quota tripped. Think independently for {retryAfter}.",
          metric: "messages",
          window: "1m",
        },
        {
          by: "user",
          max: 50_000,
          message:
            "Your daily token appetite got noticed. Digest your own thoughts for {retryAfter}.",
          metric: "tokens",
          window: "1d",
        },
        {
          by: "global",
          max: 100,
          message:
            "The room's hourly question budget is cooked. Please all discover patience for {retryAfter}.",
          metric: "messages",
          window: "1h",
        },
        {
          by: "global",
          max: 100,
          message:
            "The shared daily token brain cell is drained. Let it pretend to recover for {retryAfter}.",
          metric: "tokens",
          window: "1m",
        },
      ],
    }),
  ],
  database: sqlite({ path: env.DATABASE_URL, schema }),
});
