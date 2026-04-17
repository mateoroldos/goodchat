import type { Logger } from "@goodchat/contracts/plugins/types";
import { createAILogger } from "evlog/ai";
import type { LoggerService } from "../logger/interface";
import type { AiTelemetryService } from "./interface";

export class NoopAiTelemetryService implements AiTelemetryService {
  start({ model }: Parameters<AiTelemetryService["start"]>[0]) {
    return { finish: () => undefined, model };
  }
}

export class EvlogAiTelemetryService implements AiTelemetryService {
  readonly #logger: LoggerService;

  constructor(logger: LoggerService) {
    this.#logger = logger;
  }

  start({
    logger,
    mode,
    model,
    threadId,
    userId,
  }: Parameters<AiTelemetryService["start"]>[0]) {
    const aiLogger = createAiRunLogger({
      logger,
      loggerService: this.#logger,
      mode,
      threadId,
      userId,
    });
    const ai = createAILogger(aiLogger, { toolInputs: true });
    let done = false;

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      aiLogger.emit();
    };

    return {
      finish,
      model: ai.wrap(model),
    };
  }
}

const createAiRunLogger = ({
  logger,
  loggerService,
  mode,
  threadId,
  userId,
}: {
  logger: Logger;
  loggerService: LoggerService;
  mode: "stream" | "sync";
  threadId?: string;
  userId?: string;
}) => {
  const context = logger.getContext();
  const requestId =
    typeof context.requestId === "string" ? context.requestId : undefined;

  return loggerService.wide({
    mode,
    ...(requestId ? { parentRequestId: requestId } : {}),
    ...(threadId ? { thread: { id: threadId } } : {}),
    ...(userId ? { user: { id: userId } } : {}),
    operation: "ai-run",
  });
};
