import { defineBot } from "@goodchat/core/bot/define-bot";

export const supportEcho = defineBot({
  name: "support-echo",
  prompt: "Helps with support queries using a friendly tone.",
  platforms: ["local", "discord"],
});
