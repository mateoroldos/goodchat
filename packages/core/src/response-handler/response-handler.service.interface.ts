import type { BotConfig, Platform } from "@goodchat/core/config/models";
import type {
  BotGenerationError,
  BotInputInvalidError,
} from "@goodchat/core/response-handler/errors";
import type { Result } from "better-result";
import type { GoodbotExtensions } from "../plugins/models";

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
  text: string;
  threadEntryId: string;
}

export type ResponseMessageError = BotInputInvalidError | BotGenerationError;

export interface ResponseHandlerService {
  handleMessage(
    context: ChatEventContext,
    params: ResponseMessageParams,
    extensions?: GoodbotExtensions
  ): Promise<Result<ResponseMessageResult, ResponseMessageError>>;
}
