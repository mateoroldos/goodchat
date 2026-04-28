import type { BeforeHookDenyResult } from "@goodchat/contracts/hooks/types";
import type { MessageContext } from "@goodchat/contracts/plugins/types";
import type { UIMessageChunk } from "ai";
import type { Result } from "better-result";
import type {
  ChatResponseGenerationError,
  ChatResponseHookExecutionError,
  ChatResponseInputInvalidError,
} from "./errors";

export interface ResponseMessageSuccess {
  action: "respond";
  text: string;
  threadEntryId: string;
}

export type ResponseMessageResult =
  | BeforeHookDenyResult
  | ResponseMessageSuccess;

export interface ResponseMessageStreamSuccess {
  action: "respond";
  uiStream: ReadableStream<UIMessageChunk>;
}

export type ResponseMessageStreamResult =
  | BeforeHookDenyResult
  | ResponseMessageStreamSuccess;

export type ResponseMessageError =
  | ChatResponseInputInvalidError
  | ChatResponseHookExecutionError
  | ChatResponseGenerationError;

export interface ChatResponseService {
  handleMessage(
    context: MessageContext
  ): Promise<Result<ResponseMessageResult, ResponseMessageError>>;
  handleMessageStream(
    context: MessageContext
  ): Promise<Result<ResponseMessageStreamResult, ResponseMessageError>>;
}
