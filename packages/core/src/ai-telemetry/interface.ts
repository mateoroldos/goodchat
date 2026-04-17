import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { Logger } from "@goodchat/contracts/plugins/types";

export interface AiTelemetryOutput {
  finish: () => void;
  model: LanguageModelV3;
}

export interface AiTelemetryService {
  start(input: {
    logger: Logger;
    mode: "stream" | "sync";
    model: LanguageModelV3;
    threadId?: string;
    userId?: string;
  }): AiTelemetryOutput;
}
