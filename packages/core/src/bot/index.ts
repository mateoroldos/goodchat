import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { Result } from "better-result";
import { BotGenerationError, BotInputInvalidError } from "./errors";
import type { BotService } from "./interface";
import { incomingMessageSchema } from "./schema";
import type { BotConfig, IncomingMessage } from "./types";

export const defineBot = (config: BotConfig): BotConfig => config;

const DEFAULT_MODEL_ID = "gpt-4.1-nano";

export class DefaultBotService implements BotService {
  async sendMessage(message: IncomingMessage, bot: BotConfig) {
    const parsed = incomingMessageSchema.safeParse(message);

    if (!parsed.success) {
      return Result.err(
        new BotInputInvalidError(
          "Invalid bot message input",
          parsed.error.issues.map((issue) => issue.message)
        )
      );
    }

    const systemPrompt = `${bot.prompt}\n\nBot name: ${bot.name}`;

    const generationResult = await Result.tryPromise({
      try: () =>
        generateText({
          model: openai(DEFAULT_MODEL_ID),
          system: systemPrompt,
          prompt: message.text,
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

export type { BotService } from "./interface";
