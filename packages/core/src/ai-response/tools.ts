import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { Tool } from "ai";
import type { AiCallParams } from "./models";

export const buildTools = async (
  params: AiCallParams
): Promise<{
  tools: Record<string, Tool>;
  closeMcpClients: () => Promise<void>;
}> => {
  const staticTools = params.tools ?? {};
  const mcpServers = params.mcp ?? [];

  if (mcpServers.length === 0) {
    return { tools: staticTools, closeMcpClients: async () => undefined };
  }

  const mcpClients = [] as Awaited<ReturnType<typeof createMCPClient>>[];
  const mcpTools: Record<string, Tool> = {};

  for (const server of mcpServers) {
    const client = await createMCPClient({
      transport: createMcpTransport(server),
      name: `goodchat:${server.name}`,
    });
    mcpClients.push(client);
    const tools = (await client.tools()) as Record<string, Tool>;
    for (const [name, tool] of Object.entries(tools)) {
      if (!(name in mcpTools)) {
        mcpTools[name] = tool;
      }
    }
  }

  return {
    tools: { ...mcpTools, ...staticTools },
    closeMcpClients: async () => {
      await Promise.allSettled(mcpClients.map((client) => client.close()));
    },
  };
};

const createMcpTransport = (server: MCPServerConfig) => {
  if (server.transport.type === "stdio") {
    return new Experimental_StdioMCPTransport({
      command: server.transport.command,
      args: server.transport.args,
      env: server.transport.env,
    });
  }

  if (server.transport.type === "http") {
    return {
      type: "http" as const,
      url: server.transport.url,
      ...(server.transport.headers
        ? { headers: server.transport.headers }
        : {}),
    };
  }

  return {
    type: "sse" as const,
    url: server.transport.url,
    ...(server.transport.headers ? { headers: server.transport.headers } : {}),
  };
};
