import type { Result } from "better-result";
import type { AiResponseGenerationError } from "./errors";
import type { AiCallParams, AiResponse, AiResponseStream } from "./models";

export interface AiResponseService {
  generate(
    params: AiCallParams
  ): Promise<Result<AiResponse, AiResponseGenerationError>>;
  stream(
    params: AiCallParams
  ): Promise<Result<AiResponseStream, AiResponseGenerationError>>;
}
