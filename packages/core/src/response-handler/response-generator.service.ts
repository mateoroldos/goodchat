import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import { openai } from "@ai-sdk/openai";
import type { Tool } from "ai";
import { generateText, stepCountIs, streamText } from "ai";
import { Result } from "better-result";
import type { MCPServerConfig } from "../config/models";
import { BotGenerationError, BotInputInvalidError } from "./errors";
import type { ResponseRequest } from "./models";
import { incomingMessageSchema } from "./models";
import type { ResponseGeneratorService } from "./response-generator.service.interface";

const DEFAULT_MODEL_ID = "gpt-4.1-nano";
const TOOL_USE_MAX_STEPS = 8;

export class DefaultResponseGeneratorService
  implements ResponseGeneratorService
{
  async generateResponse(request: ResponseRequest) {
    const parsed = incomingMessageSchema.safeParse(request.message);

    if (!parsed.success) {
      return Result.err(
        new BotInputInvalidError(
          "Invalid bot message input",
          parsed.error.issues.map((issue) => issue.message)
        )
      );
    }

    const baseSystemPrompt = `${request.botConfig.prompt}\n\nBot name: ${request.botConfig.name}`;
    const systemPromptExtensions = request.runtime?.systemPromptExtensions;
    const systemPrompt = systemPromptExtensions
      ? `${baseSystemPrompt}\n\n${systemPromptExtensions}`
      : baseSystemPrompt;

    const modelId = request.runtime?.modelId ?? DEFAULT_MODEL_ID;
    const toolsResult = await Result.tryPromise({
      try: () => createRuntimeTools(request.runtime),
      catch: (cause) =>
        new BotGenerationError(
          "Failed to initialize tools",
          [cause instanceof Error ? cause.message : "Unknown tool error"],
          cause
        ),
    });

    if (toolsResult.isErr()) {
      return toolsResult;
    }

    const { tools, closeMcpClients } = toolsResult.value;
    const hasTools = Object.keys(tools).length > 0;

    const generationResult = await Result.tryPromise({
      try: async () => {
        try {
          return await generateText({
            model: openai(modelId),
            system: systemPrompt,
            prompt: request.message.text,
            ...(hasTools && {
              tools,
              stopWhen: stepCountIs(TOOL_USE_MAX_STEPS),
            }),
          });
        } finally {
          await closeMcpClients();
        }
      },
      catch: (cause) => {
        const errorMessage =
          cause instanceof Error ? cause.message : "Unknown AI error";
        return new BotGenerationError(
          "Failed to generate response",
          [errorMessage],
          cause
        );
      },
    });

    return generationResult.map(({ text }) => ({ text }));
  }

  async streamResponse(request: ResponseRequest) {
    const parsed = incomingMessageSchema.safeParse(request.message);

    if (!parsed.success) {
      return Result.err(
        new BotInputInvalidError(
          "Invalid bot message input",
          parsed.error.issues.map((issue) => issue.message)
        )
      );
    }

    const baseSystemPrompt = `${request.botConfig.prompt}\n\nBot name: ${request.botConfig.name}`;
    const systemPromptExtensions = request.runtime?.systemPromptExtensions;
    const systemPrompt = systemPromptExtensions
      ? `${baseSystemPrompt}\n\n${systemPromptExtensions}`
      : baseSystemPrompt;

    const modelId = request.runtime?.modelId ?? DEFAULT_MODEL_ID;
    const toolsResult = await Result.tryPromise({
      try: () => createRuntimeTools(request.runtime),
      catch: (cause) =>
        new BotGenerationError(
          "Failed to initialize tools",
          [cause instanceof Error ? cause.message : "Unknown tool error"],
          cause
        ),
    });

    if (toolsResult.isErr()) {
      return toolsResult;
    }

    const { tools, closeMcpClients } = toolsResult.value;
    const hasTools = Object.keys(tools).length > 0;

    const streamResult = await Result.tryPromise({
      try: async () =>
        await Promise.resolve(
          streamText({
            model: openai(modelId),
            system: systemPrompt,
            prompt: request.message.text,
            ...(hasTools && {
              tools,
              stopWhen: stepCountIs(TOOL_USE_MAX_STEPS),
            }),
            onFinish: async () => {
              await closeMcpClients();
            },
            onError: async () => {
              await closeMcpClients();
            },
          })
        ),
      catch: (cause: unknown) => {
        const errorMessage =
          cause instanceof Error ? cause.message : "Unknown AI error";
        return new BotGenerationError(
          "Failed to generate response",
          [errorMessage],
          cause
        );
      },
    });

    return streamResult.map((result) => ({
      uiStream: result.toUIMessageStream(),
    }));
  }
}

const createRuntimeTools = async (
  runtime: ResponseRequest["runtime"]
): Promise<{
  tools: Record<string, Tool>;
  closeMcpClients: () => Promise<void>;
}> => {
  const runtimeTools = runtime?.tools ?? {};
  const mcpServers = runtime?.mcp ?? [];
  if (mcpServers.length === 0) {
    return { tools: runtimeTools, closeMcpClients: async () => undefined };
  }

  const mcpClients = [] as Awaited<ReturnType<typeof createMCPClient>>[];
  const mcpTools: Record<string, Tool> = {};

  for (const server of mcpServers) {
    const client = await createMCPClient({
      transport: createMcpTransport(server),
      name: `goodbot:${server.name}`,
    });
    console.log("MCP Server Initialized:", server);
    mcpClients.push(client);
    const tools = (await client.tools()) as Record<string, Tool>;
    console.log("MCP Server Tools:", tools);
    for (const [name, tool] of Object.entries(tools)) {
      if (!(name in mcpTools)) {
        mcpTools[name] = tool;
      }
    }
  }

  return {
    tools: { ...mcpTools, ...runtimeTools },
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
