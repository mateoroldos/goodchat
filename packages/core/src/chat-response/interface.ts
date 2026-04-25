import type { MessageContext } from "@goodchat/contracts/plugins/types";
import type { UIMessageChunk } from "ai";
import type { Result } from "better-result";
import type {
  ChatResponseGenerationError,
  ChatResponseHookExecutionError,
  ChatResponseInputInvalidError,
} from "./errors";

export interface ResponseMessageResult {
  text: string;
  threadEntryId: string;
}

export interface ResponseMessageStreamResult {
  uiStream: ReadableStream<UIMessageChunk>;
}

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
