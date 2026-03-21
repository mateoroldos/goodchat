import { definePlugin } from "@goodchat/core/plugins/define";
import { z } from "zod";

export const linear = definePlugin({
  name: "linear",

  env: z.object({
    LINEAR_API_TOKEN: z
      .string()
      .describe("Linear Personal API Key or OAuth token"),
  }),

  create: (env) => {
    const authorization = env.LINEAR_API_TOKEN.startsWith("Bearer ")
      ? env.LINEAR_API_TOKEN
      : `Bearer ${env.LINEAR_API_TOKEN}`;

    return {
      systemPrompt:
        "You have access to Linear via MCP tools. Use them to create, search, and update issues when users mention bugs, tasks, or feature requests.",
      mcp: [
        {
          name: "linear",
          transport: {
            type: "sse",
            url: "https://mcp.linear.app/mcp",
            headers: {
              Authorization: authorization,
            },
          },
        },
      ],
    };
  },
});
