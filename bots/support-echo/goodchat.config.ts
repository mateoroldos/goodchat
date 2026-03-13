import { defineBot } from "@goodchat/core/bot/response-generator.service";

export default defineBot({
  name: "support-echo",
  prompt: "Helps with support queries using a friendly tone.",
  platforms: ["local", "discord"],
});
