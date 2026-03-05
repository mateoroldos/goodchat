import { defineBot } from "@goodchat/core/bot";

export default defineBot({
  name: "local-echo",
  prompt: "Echoes incoming messages for local testing.",
  platforms: ["local"],
});
