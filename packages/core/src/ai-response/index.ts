import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { openai } from "@ai-sdk/openai";
import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { Tool } from "ai";
import { generateText, stepCountIs, streamText } from "ai";
import { Result } from "better-result";
import { AiResponseGenerationError } from "./errors";
import type { AiResponseService } from "./interface";
import type { AiCallParams } from "./models";

const DEFAULT_MODEL_ID = "openai/gpt-4.1-nano";
const DIRECT_MODEL_ID_REGEX = /^[a-z0-9-]+:[\w.-]+$/i;
const TOOL_USE_MAX_STEPS = 8;

interface AiProviderFunctions {
  generateText: typeof generateText;
  streamText: typeof streamText;
}

export class DefaultAiResponseService implements AiResponseService {
  readonly #generateText: typeof generateText;
  readonly #streamText: typeof streamText;

  constructor(provider: AiProviderFunctions = { generateText, streamText }) {
    this.#generateText = provider.generateText;
    this.#streamText = provider.streamText;
  }

  generate(params: AiCallParams) {
    return Result.tryPromise({
      try: async () => {
        const { model, system, prompt, tools, closeMcpClients } =
          await this.#prepareCall(params);
        try {
          const result = await this.#generateText({
            model,
            system,
            prompt,
            ...(tools && { tools, stopWhen: stepCountIs(TOOL_USE_MAX_STEPS) }),
          });
          return { text: result.text };
        } finally {
          await closeMcpClients();
        }
      },
      catch: (cause) =>
        new AiResponseGenerationError(
          cause instanceof Error
            ? cause.message
            : "Failed to generate response",
          [],
          cause
        ),
    });
  }

  stream(params: AiCallParams) {
    return Result.tryPromise({
      try: async () => {
        const { model, system, prompt, tools, closeMcpClients } =
          await this.#prepareCall(params);
        const result = this.#streamText({
          model,
          system,
          prompt,
          ...(tools && { tools, stopWhen: stepCountIs(TOOL_USE_MAX_STEPS) }),
          onFinish: async () => {
            await closeMcpClients();
          },
          onError: async () => {
            await closeMcpClients();
          },
        });
        return { uiStream: result.toUIMessageStream() };
      },
      catch: (cause: unknown) =>
        new AiResponseGenerationError(
          cause instanceof Error
            ? cause.message
            : "Failed to generate response",
          [],
          cause
        ),
    });
  }

  async #prepareCall(params: AiCallParams) {
    const { tools, closeMcpClients } = await buildTools(params);
    return {
      model: resolveModel(params.model ?? DEFAULT_MODEL_ID),
      system: params.systemPrompt,
      prompt: params.userMessage,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      closeMcpClients,
    };
  }
}

const resolveModel = (modelId: string) => {
  if (!DIRECT_MODEL_ID_REGEX.test(modelId)) {
    return modelId;
  }

  const separatorIndex = modelId.indexOf(":");
  const provider = modelId.slice(0, separatorIndex).toLowerCase();
  const modelName = modelId.slice(separatorIndex + 1);

  switch (provider) {
    case "openai":
      return openai(modelName);
    case "anthropic":
      return anthropic(modelName);
    case "google":
      return google(modelName);
    default:
      throw new Error(
        `Direct provider "${provider}" is not supported. Use provider/model for gateway models or provider:model for supported direct providers.`
      );
  }
};

const buildTools = async (
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
