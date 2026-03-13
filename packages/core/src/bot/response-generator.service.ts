import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Result } from "better-result";
import type { RawBotConfig } from "../config/models";
import { BotGenerationError, BotInputInvalidError } from "./errors";
import type { ResponseRequest } from "./models";
import { incomingMessageSchema } from "./models";
import type { ResponseGeneratorService } from "./response-generator.service.interface";

const DEFAULT_MODEL_ID = "gpt-4.1-nano";

export const defineBot = (config: RawBotConfig): RawBotConfig => config;

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

    const systemPrompt = `${request.botConfig.prompt}\n\nBot name: ${request.botConfig.name}`;
    const modelId = request.runtime?.modelId ?? DEFAULT_MODEL_ID;

    const generationResult = await Result.tryPromise({
      try: () =>
        generateText({
          model: openai(modelId),
          system: systemPrompt,
          prompt: request.message.text,
        }),
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
}
