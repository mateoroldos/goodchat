import type { Result } from "better-result";
import type { BotGenerationError, BotInputInvalidError } from "./errors";
import type { BotResponse, ResponseRequest } from "./models";

export interface ResponseGeneratorService {
  generateResponse(
    request: ResponseRequest
  ): Promise<Result<BotResponse, BotInputInvalidError | BotGenerationError>>;
}
