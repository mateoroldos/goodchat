import type { LanguageModelV3 } from "@ai-sdk/provider";
import { generateText, stepCountIs, streamText } from "ai";
import { Result } from "better-result";
import type { AiTelemetryService } from "../ai-telemetry/interface";
import { NoopAiTelemetryService } from "../ai-telemetry/service";
import { AiResponseGenerationError } from "./errors";
import type { AiResponseService } from "./interface";
import type { AiCallParams, AiRunTelemetry } from "./models";
import { resolveModelFromRegistry } from "./provider-registry";
import { buildAiRunTelemetry, extractErrorMessage } from "./telemetry";
import { buildTools } from "./tools";

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
