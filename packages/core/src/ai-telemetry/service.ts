import type { Logger } from "@goodchat/contracts/plugins/types";
import type { RequestLogger } from "evlog";
import { createAILogger, createEvlogIntegration } from "evlog/ai";
import { NOOP_LOGGER } from "../logger/noop";
import type { AiTelemetryService } from "./interface";

export class NoopAiTelemetryService implements AiTelemetryService {
  apply({ model }: Parameters<AiTelemetryService["apply"]>[0]) {
    return { model };
  }
}

export class EvlogAiTelemetryService implements AiTelemetryService {
  apply({ logger, model }: Parameters<AiTelemetryService["apply"]>[0]) {
    if (!logger || logger === NOOP_LOGGER) {
      return { model };
    }

    const ai = createAILogger(toRequestLogger(logger), { toolInputs: true });
    return {
      model: ai.wrap(model),
      telemetry: {
        experimental_telemetry: {
          integrations: [createEvlogIntegration(ai)],
          isEnabled: true,
        },
      },
    };
  }
}

const toRequestLogger = (
  logger: Logger
): RequestLogger<Record<string, unknown>> => {
  return {
    emit: (...args) => {
      logger.emit(...args);
      return null;
    },
    error: (...args) => {
      logger.error(...args);
    },
    getContext: () => logger.getContext(),
    info: (...args) => {
      logger.info(...args);
    },
    set: (fields) => {
      logger.set(fields);
    },
    warn: (...args) => {
      logger.warn(...args);
    },
  };
};
