import type z from "zod";
import type { mcpServerSchema, mcpTransportSchema, toolSchema } from "./models";

export type MCPTransportConfig = z.infer<typeof mcpTransportSchema>;
export type MCPServerConfig = z.infer<typeof mcpServerSchema>;
export type ToolConfig = z.infer<typeof toolSchema>;
