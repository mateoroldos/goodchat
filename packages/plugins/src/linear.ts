import { definePlugin } from "@goodchat/contracts/plugins/define";
import { z } from "zod";

export const linear = definePlugin({
  name: "linear",

  env: z.object({
    LINEAR_API_TOKEN: z
      .string()
      .describe("Linear Personal API Key or OAuth token"),
  }),

  paramsSchema: z.object({
    team: z.string().min(1, "Team is required"),
  }),

  create: (env, params) => {
    const authorization = env.LINEAR_API_TOKEN.startsWith("Bearer ")
      ? env.LINEAR_API_TOKEN
      : `Bearer ${env.LINEAR_API_TOKEN}`;

    return {
      systemPrompt: `You have access to Linear via MCP tools for team "${params.team}". Use them to create, search, and update issues when users mention bugs, tasks, or feature requests.`,
      mcp: [
        {
          name: "linear",
          transport: {
            type: "http",
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
