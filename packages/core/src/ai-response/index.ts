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
import type {
  AiCallParams,
  AiRunTelemetry,
  AiRunToolCallTelemetry,
} from "./models";
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
        const startedAt = new Date();
        const { model, system, prompt, tools, closeMcpClients, finish } =
          await this.#prepareCall(params);
        const modelRef = params.model as NonNullable<AiCallParams["model"]>;

        const { logger } = params;

        try {
          const result = await this.#generateText({
            model,
            system,
            prompt,
            ...(tools && { tools, stopWhen: stepCountIs(TOOL_USE_MAX_STEPS) }),
          });
          const finishedAt = new Date();
          return {
            telemetry: buildAiRunTelemetry({
              finishedAt,
              mode: "sync",
              result: result as unknown as Record<string, unknown>,
              startedAt,
              model: modelRef,
            }),
            text: result.text,
          };
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
          finish();
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
        const startedAt = new Date();
        const { model, system, prompt, tools, closeMcpClients, finish } =
          await this.#prepareCall(params);
        const modelRef = params.model as NonNullable<AiCallParams["model"]>;

        const { logger } = params;

        let done = false;
        let resolveTelemetry!: (value: AiRunTelemetry) => void;
        const telemetry = new Promise<AiRunTelemetry>((resolve) => {
          resolveTelemetry = resolve;
        });

        const finalizeTelemetry = (value: AiRunTelemetry) => {
          if (done) {
            return;
          }
          done = true;
          resolveTelemetry(value);
        };

        const result = this.#streamText({
          model,
          system,
          prompt,
          ...(tools && { tools, stopWhen: stepCountIs(TOOL_USE_MAX_STEPS) }),
          onFinish: async (event) => {
            const finishedAt = new Date();
            finalizeTelemetry(
              buildAiRunTelemetry({
                finishedAt,
                mode: "stream",
                result: event,
                startedAt,
                model: modelRef,
              })
            );
            finish();
            await closeMcpClients();
          },
          onError: async (event) => {
            const finishedAt = new Date();
            const errorMessage = extractErrorMessage(event);
            finalizeTelemetry({
              createdAt: startedAt.toISOString(),
              durationMs: finishedAt.getTime() - startedAt.getTime(),
              errorCode: "AI_RESPONSE_STREAM_FAILED",
              errorMessage,
              finishedAt: finishedAt.toISOString(),
              hadError: true,
              mode: "stream",
              modelId: modelRef.modelId,
              provider: modelRef.provider,
              toolCalls: [],
            });
            logger.error("AI stream ended with provider error", {
              error: {
                code: "AI_RESPONSE_STREAM_FAILED",
                fix: "Check model availability and provider/API credentials.",
                why: "The provider stream emitted an error before completion.",
              },
            });
            finish();
            await closeMcpClients();
          },
        });
        return { telemetry, uiStream: result.toUIMessageStream() };
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

    const model = resolveModelFromRegistry(params.model);

    const instrumented = this.#telemetry.start({
      logger: params.logger,
      mode: params.mode ?? "sync",
      model: model as LanguageModelV3,
      threadId: params.threadId,
      userId: params.userId,
    });

    return {
      model: instrumented.model,
      system: params.systemPrompt,
      prompt: params.userMessage,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      closeMcpClients,
      finish: instrumented.finish,
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

const buildAiRunTelemetry = ({
  finishedAt,
  mode,
  result,
  startedAt,
  model,
}: {
  finishedAt: Date;
  mode: "stream" | "sync";
  result: Record<string, unknown>;
  startedAt: Date;
  model: NonNullable<AiCallParams["model"]>;
}): AiRunTelemetry => {
  const usage = extractObject(result.totalUsage) ?? extractObject(result.usage);
  const toolCalls = extractToolCalls(result);

  return {
    createdAt: startedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    finishReason:
      extractString(result.finishReason) ??
      extractString(result.rawFinishReason),
    finishedAt: finishedAt.toISOString(),
    hadError: false,
    inputTokens: extractNumber(usage?.inputTokens),
    mode,
    modelId: model.modelId,
    outputTokens: extractNumber(usage?.outputTokens),
    provider: model.provider,
    providerMetadata: extractObject(result.providerMetadata),
    toolCalls,
    totalTokens: extractNumber(usage?.totalTokens),
    usage,
  };
};

const extractToolCalls = (
  result: Record<string, unknown>
): AiRunToolCallTelemetry[] => {
  const { callItems, resultItems } = collectToolItems(result);

  const resultByCallId = new Map<string, Record<string, unknown>>();
  for (const item of resultItems) {
    const object = extractObject(item);
    if (!object) {
      continue;
    }
    const toolCallId =
      extractString(object.toolCallId) ?? extractString(object.callId);
    if (toolCallId) {
      resultByCallId.set(toolCallId, object);
    }
  }

  const createdAt = new Date().toISOString();
  return callItems
    .map((item) => {
      const object = extractObject(item);
      if (!object) {
        return null;
      }
      const toolCallId =
        extractString(object.toolCallId) ?? extractString(object.callId);
      const toolName =
        extractString(object.toolName) ??
        extractString(object.tool) ??
        extractString(object.name);
      if (!toolName) {
        return null;
      }

      const toolResult = toolCallId
        ? resultByCallId.get(toolCallId)
        : undefined;
      return {
        createdAt,
        durationMs: extractNumber(toolResult?.durationMs),
        error:
          extractObject(toolResult?.error) ??
          (extractBool(toolResult?.isError)
            ? { message: "Tool call failed" }
            : undefined),
        input: extractObject(object.input),
        output:
          extractObject(toolResult?.output) ??
          extractObject(toolResult?.result),
        status:
          extractBool(toolResult?.isError) || Boolean(toolResult?.error)
            ? "error"
            : "success",
        ...(toolCallId ? { toolCallId } : {}),
        toolName,
      } as AiRunToolCallTelemetry;
    })
    .filter((value): value is AiRunToolCallTelemetry => Boolean(value));
};

const collectToolItems = (result: Record<string, unknown>) => {
  const callItems = [...extractArray(result.toolCalls)];
  const resultItems = [...extractArray(result.toolResults)];

  for (const step of extractArray(result.steps)) {
    const stepObject = extractObject(step);
    if (!stepObject) {
      continue;
    }
    callItems.push(...extractArray(stepObject.toolCalls));
    resultItems.push(...extractArray(stepObject.toolResults));
  }

  return { callItems, resultItems };
};

const extractObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const extractArray = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

const extractNumber = (value: unknown): number | undefined => {
  return typeof value === "number" ? value : undefined;
};

const extractString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const extractBool = (value: unknown): boolean => {
  return value === true;
};

const extractErrorMessage = (event: unknown): string => {
  if (!event || typeof event !== "object") {
    return "Unknown stream error";
  }

  const object = event as { error?: unknown };
  if (object.error instanceof Error) {
    return object.error.message;
  }

  if (typeof object.error === "string") {
    return object.error;
  }

  return "Unknown stream error";
};
