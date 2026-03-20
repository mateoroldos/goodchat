import { definePlugin } from "@goodchat/core/plugins/define";
import { tool, zodSchema } from "ai";
import { z } from "zod";

const PRIORITY_MAP: Record<string, number> = {
  urgent: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const createIssueSchema = z.object({
  description: z
    .string()
    .optional()
    .describe("Detailed issue description in markdown"),
  priority: z
    .enum(["urgent", "high", "medium", "low"])
    .optional()
    .describe("Issue priority"),
  teamKey: z
    .string()
    .optional()
    .describe(
      "Team key to assign the issue to (e.g. ENG). Defaults to configured team."
    ),
  title: z.string().describe("Short, descriptive issue title"),
});

const searchIssuesSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .default(5)
    .describe("Max number of results"),
  query: z.string().describe("Search query"),
});

export const linear = definePlugin({
  name: "linear",

  env: z.object({
    LINEAR_API_TOKEN: z
      .string()
      .describe("Linear Personal API Key or OAuth token"),
    LINEAR_TEAM_KEY: z
      .string()
      .optional()
      .describe("Default team key (e.g. ENG)"),
  }),

  create: (env) => {
    const headers = {
      Authorization: env.LINEAR_API_TOKEN,
      "Content-Type": "application/json",
    };

    const gqlFetch = async <T>(body: string): Promise<T> => {
      const res = await fetch("https://api.linear.app/graphql", {
        method: "POST",
        headers,
        body,
      });
      if (!res.ok) {
        throw new Error(`Linear API error: ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as {
        data: T;
        errors?: { message: string }[];
      };
      if (json.errors?.length) {
        throw new Error(json.errors.map((e) => e.message).join(", "));
      }
      return json.data;
    };

    return {
      systemPrompt:
        "You have access to Linear project management tools. You can create issues and search for existing ones. When users mention bugs, tasks, or feature requests, proactively offer to create a Linear issue.",

      tools: {
        linearCreateIssue: tool({
          description:
            "Create a new issue in Linear. Use when the user wants to log a bug, task, or feature request.",
          inputSchema: zodSchema(createIssueSchema),
          execute: async ({ title, description, priority, teamKey }) => {
            const targetTeamKey = teamKey ?? env.LINEAR_TEAM_KEY;

            if (!targetTeamKey) {
              throw new Error(
                "No team specified. Provide teamKey in the tool call or set LINEAR_TEAM_KEY in your environment."
              );
            }

            const teamData = await gqlFetch<{
              teams: { nodes: { id: string; key: string }[] };
            }>(
              JSON.stringify({ query: "query { teams { nodes { id key } } }" })
            );

            const team = teamData.teams.nodes.find(
              (t) => t.key.toUpperCase() === targetTeamKey.toUpperCase()
            );

            if (!team) {
              throw new Error(`Team with key "${targetTeamKey}" not found`);
            }

            const issueData = await gqlFetch<{
              issueCreate: {
                issue: { id: string; identifier: string; url: string };
              };
            }>(
              JSON.stringify({
                query: `
                  mutation CreateIssue($input: IssueCreateInput!) {
                    issueCreate(input: $input) {
                      issue { id identifier url }
                    }
                  }
                `,
                variables: {
                  input: {
                    description,
                    priority: priority ? PRIORITY_MAP[priority] : undefined,
                    teamId: team.id,
                    title,
                  },
                },
              })
            );

            const issue = issueData.issueCreate.issue;
            return {
              id: issue.id,
              identifier: issue.identifier,
              message: `Created issue ${issue.identifier}: ${title}`,
              url: issue.url,
            };
          },
        }),

        linearSearchIssues: tool({
          description: "Search for existing Linear issues by keyword.",
          inputSchema: zodSchema(searchIssuesSchema),
          execute: async ({ query, limit }) => {
            const data = await gqlFetch<{
              issueSearch: {
                nodes: {
                  id: string;
                  identifier: string;
                  title: string;
                  state: { name: string };
                  url: string;
                }[];
              };
            }>(
              JSON.stringify({
                query: `
                  query SearchIssues($query: String!, $first: Int) {
                    issueSearch(query: $query, first: $first) {
                      nodes { id identifier title state { name } url }
                    }
                  }
                `,
                variables: { first: limit, query },
              })
            );

            return data.issueSearch.nodes.map((issue) => ({
              identifier: issue.identifier,
              status: issue.state.name,
              title: issue.title,
              url: issue.url,
            }));
          },
        }),
      },
    };
  },
});
