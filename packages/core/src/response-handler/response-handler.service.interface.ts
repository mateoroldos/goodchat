import type {
  BotGenerationError,
  BotInputInvalidError,
} from "@goodchat/core/bot/errors";
import type { BotConfig, Platform } from "@goodchat/core/config/models";
import type { Result } from "better-result";

export interface ChatEventContext {
  adapterName: string;
  botConfig: BotConfig;
  platform: Platform;
  threadId: string;
  userId: string;
}

export interface ResponseMessageParams {
  text: string;
}

export interface ResponseMessageResult {
  logId: string;
  text: string;
}

export type ResponseMessageError = BotInputInvalidError | BotGenerationError;

export interface ResponseHandlerService {
  handleMessage(
    context: ChatEventContext,
    params: ResponseMessageParams
  ): Promise<Result<ResponseMessageResult, ResponseMessageError>>;
}
