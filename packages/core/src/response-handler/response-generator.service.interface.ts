import type { Result } from "better-result";
import type { BotGenerationError, BotInputInvalidError } from "./errors";
import type { BotResponse, BotResponseStream, ResponseRequest } from "./models";

export interface ResponseGeneratorService {
  generateResponse(
    request: ResponseRequest
  ): Promise<Result<BotResponse, BotInputInvalidError | BotGenerationError>>;
  streamResponse(
    request: ResponseRequest
  ): Promise<
    Result<BotResponseStream, BotInputInvalidError | BotGenerationError>
  >;
}
