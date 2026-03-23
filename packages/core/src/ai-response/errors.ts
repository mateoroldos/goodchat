import { TaggedError } from "better-result";

export class AiResponseGenerationError extends TaggedError(
  "AiResponseGenerationError"
)<{
  message: string;
  code: "AI_RESPONSE_GENERATION_FAILED";
  details?: string[];
}>() {
  constructor(message: string, details?: string[], cause?: unknown) {
    super({ message, code: "AI_RESPONSE_GENERATION_FAILED", details });
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}
