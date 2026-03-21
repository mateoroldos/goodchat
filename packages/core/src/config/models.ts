import z from "zod";

export const mcpTransportSchema = z.union([
  z.object({
    headers: z.record(z.string(), z.string()).optional(),
    type: z.literal("sse"),
    url: z.url(),
  }),
  z.object({
    headers: z.record(z.string(), z.string()).optional(),
    type: z.literal("http"),
    url: z.url(),
  }),
  z.object({
    args: z.array(z.string()).optional(),
    command: z.string().min(1, "MCP command is required"),
    env: z.record(z.string(), z.string()).optional(),
    type: z.literal("stdio"),
  }),
]);

export type MCPTransportConfig = z.infer<typeof mcpTransportSchema>;

export const mcpServerSchema = z.object({
  name: z.string().min(1, "MCP server name is required"),
  transport: mcpTransportSchema,
});

export type MCPServerConfig = z.infer<typeof mcpServerSchema>;

export const CHAT_PLATFORMS = [
  "local",
  "slack",
  "discord",
  "teams",
  "gchat",
] as const;

export const platformSchema = z.enum(CHAT_PLATFORMS);

export type Platform = z.infer<typeof platformSchema>;

export const botConfigSchema = z.object({
  name: z.string().min(1, "Bot name is required"),
  prompt: z.string().min(1, "Bot prompt is required"),
  platforms: z.array(platformSchema).min(1, "Platform is required"),
});

export type BotConfigInput = z.infer<typeof botConfigSchema>;

export type BotConfig = BotConfigInput & {
  id: string;
};

export const deriveBotId = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
