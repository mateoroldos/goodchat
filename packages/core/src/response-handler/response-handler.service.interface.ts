import type { BotConfig, Platform } from "@goodbot/core/config/models";
import type {
  BotGenerationError,
  BotInputInvalidError,
} from "@goodbot/core/response-handler/errors";
import type { UIMessageChunk } from "ai";
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

export interface ResponseMessageStreamResult {
  uiStream: ReadableStream<UIMessageChunk>;
}

export type ResponseMessageError = BotInputInvalidError | BotGenerationError;

export interface ResponseHandlerService {
  handleMessage(
    context: ChatEventContext,
    params: ResponseMessageParams,
    extensions?: GoodbotExtensions
  ): Promise<Result<ResponseMessageResult, ResponseMessageError>>;
  handleMessageStream(
    context: ChatEventContext,
    params: ResponseMessageParams,
    extensions?: GoodbotExtensions
  ): Promise<Result<ResponseMessageStreamResult, ResponseMessageError>>;
}
