import type { LanguageModelV3 } from "@ai-sdk/provider";
import type { Logger } from "@goodchat/contracts/plugins/types";
import type { generateText } from "ai";

type ExperimentalTelemetry = NonNullable<
  Parameters<typeof generateText>[0]["experimental_telemetry"]
>;

export interface AiTelemetryOutput {
  model: LanguageModelV3;
  telemetry?: {
    experimental_telemetry: ExperimentalTelemetry;
  };
}

export interface AiTelemetryService {
  apply(input: { logger?: Logger; model: LanguageModelV3 }): AiTelemetryOutput;
}
