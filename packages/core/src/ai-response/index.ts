import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type { Tool } from "ai";
import { generateText, stepCountIs, streamText } from "ai";
import { Result } from "better-result";
import type { AiTelemetryService } from "../ai-telemetry/interface";
import { NoopAiTelemetryService } from "../ai-telemetry/service";
import { AiResponseGenerationError } from "./errors";
import type { AiResponseService } from "./interface";
import type { AiCallParams } from "./models";
import { resolveModelFromRegistry } from "./provider-registry";

const TOOL_USE_MAX_STEPS = 8;

interface AiProviderFunctions {
  generateText: typeof generateText;
  streamText: typeof streamText;
}

export class DefaultAiResponseService implements AiResponseService {
  readonly #generateText: typeof generateText;
  readonly #streamText: typeof streamText;
  readonly #telemetry: AiTelemetryService;

  constructor(
    provider: AiProviderFunctions = { generateText, streamText },
    telemetry: AiTelemetryService = new NoopAiTelemetryService()
  ) {
    this.#generateText = provider.generateText;
    this.#streamText = provider.streamText;
    this.#telemetry = telemetry;
  }

  generate(params: AiCallParams) {
    return Result.tryPromise({
      try: async () => {
        const { model, system, prompt, tools, closeMcpClients, telemetry } =
          await this.#prepareCall(params);

        const { logger } = params;

        try {
          const result = await this.#generateText({
            model,
            system,
            prompt,
            ...(tools && { tools, stopWhen: stepCountIs(TOOL_USE_MAX_STEPS) }),
            ...telemetry,
          });
          logger.set({
            ai: {
              outcome: "success",
              responseLength: result.text.length,
            },
          });
          return { text: result.text };
        } catch (error) {
          logger.error("AI text generation failed", {
            error: {
              code: "AI_RESPONSE_GENERATION_FAILED",
              fix: "Validate provider credentials, model availability, tools, and MCP transport.",
              message: error instanceof Error ? error.message : "Unknown error",
              type: error instanceof Error ? error.name : "UnknownError",
              why: "The provider call failed while generating text.",
            },
          });
          throw error;
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
        const { model, system, prompt, tools, closeMcpClients, telemetry } =
          await this.#prepareCall(params);

        const { logger } = params;

        const result = this.#streamText({
          model,
          system,
          prompt,
          ...(tools && { tools, stopWhen: stepCountIs(TOOL_USE_MAX_STEPS) }),
          ...telemetry,
          onFinish: async () => {
            logger.set({
              ai: {
                outcome: "stream-finished",
              },
            });
            await closeMcpClients();
          },
          onError: async () => {
            logger.error("AI stream ended with provider error", {
              error: {
                code: "AI_RESPONSE_STREAM_FAILED",
                fix: "Check model availability and provider/API credentials.",
                why: "The provider stream emitted an error before completion.",
              },
            });
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
    if (!params.model) {
      throw new Error(
        "No model is configured. Set model in createGoodchat({ model: ... })."
      );
    }

    const { logger } = params;

    const model = resolveModelFromRegistry(params.model);
    logger.set({
      ai: {
        mcpServerCount: params.mcp?.length ?? 0,
        model: params.model,
        toolCount: Object.keys(tools).length,
      },
    });

    const instrumented = this.#telemetry.apply({
      logger,
      model: model as LanguageModelV3,
    });

    return {
      model: instrumented.model,
      system: params.systemPrompt,
      prompt: params.userMessage,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      closeMcpClients,
      telemetry: instrumented.telemetry,
    };
  }
}

const buildTools = async (
  params: AiCallParams
): Promise<{
  tools: Record<string, Tool>;
  closeMcpClients: () => Promise<void>;
}> => {
  const staticTools = params.tools ?? {};
  const mcpServers = params.mcp ?? [];

  const { logger } = params;

  if (mcpServers.length === 0) {
    logger.set({
      ai: {
        mcpClientCount: 0,
      },
    });
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

  logger.set({
    ai: {
      mcpClientCount: mcpClients.length,
      mcpToolCount: Object.keys(mcpTools).length,
    },
  });

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
