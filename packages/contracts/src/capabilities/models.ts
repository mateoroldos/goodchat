import type { Tool } from "ai";
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

export const mcpServerSchema = z.object({
  name: z.string().min(1, "MCP server name is required"),
  transport: mcpTransportSchema,
});

export const toolSchema = z.custom<Tool>(
  (value) => value !== null && typeof value === "object",
  {
    message: "Tool must be an object",
  }
);
