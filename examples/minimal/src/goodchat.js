import { sqlite } from "@goodchat/adapter-sqlite";
import { createGoodchat } from "@goodchat/core";
import { schema } from "./db/schema";
export const goodchat = createGoodchat({
    name: "Minimal",
    prompt: "You are a helpful assistant",
    platforms: ["local"],
    model: "openai/gpt-4.1-mini",
    withDashboard: true,
    auth: {
        enabled: true,
        mode: "password",
        localChatPublic: false,
        password: process.env.GOODCHAT_DASHBOARD_PASSWORD,
    },
    database: sqlite({
        path: process.env.DATABASE_URL || "./goodchat.db",
        schema,
    }),
    isServerless: process.env.SERVERLESS === "true" || process.env.VERCEL === "1",
});
