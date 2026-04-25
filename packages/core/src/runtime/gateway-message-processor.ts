import type { Bot } from "@goodchat/contracts/config/types";
import type { MessageContext } from "@goodchat/contracts/plugins/types";
import { Result } from "better-result";
import { ChatResponseGenerationError } from "../chat-response/errors";
import type {
  ChatResponseService,
  ResponseMessageError,
  ResponseMessageResult,
} from "../chat-response/interface";
import type {
  ChatGatewayHandlers,
  ChatGatewayService,
} from "../gateway/interface";
import type { LoggerService } from "../logger/interface";
import { parseThreadPlatform } from "./platform-parser";

const DEFAULT_ERROR_MESSAGE = "Sorry, I ran into an error while responding.";

type ThreadHandle = Parameters<
  NonNullable<ChatGatewayHandlers["onNewMention"]>
>[0];

type ThreadMessage = Parameters<
  NonNullable<ChatGatewayHandlers["onNewMention"]>
>[1];

type GatewayRequestKind = "mention" | "subscribed-message";

interface GatewayMessageProcessorDependencies {
  bot: Bot;
  chatResponse: ChatResponseService;
  logger: LoggerService;
}

const safeHandleMessage = async (
  chatResponse: ChatResponseService,
  context: MessageContext
): Promise<Result<ResponseMessageResult, ResponseMessageError>> => {
  try {
    return await chatResponse.handleMessage(context);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected response service error";
    return Result.err(
      new ChatResponseGenerationError(
        message,
        ["Response service threw instead of returning Result"],
        error
      )
    );
  }
};

const registerContextLog = (
  thread: ThreadHandle,
  message: ThreadMessage,
  logger: LoggerService
) => {
  const log = logger.request();
  log.set({
    adapter: "gateway",
    message: {
      length: message.text.length,
    },
    thread: { id: thread.id },
    user: { id: message.author.userId },
  });

  return log;
};

const buildMessageContext = (
  bot: Bot,
  platform: MessageContext["platform"],
  thread: ThreadHandle,
  message: ThreadMessage
): MessageContext => ({
  adapterName: platform,
  botId: bot.id,
  botName: bot.name,
  platform,
  text: message.text,
  threadId: thread.id,
  userId: message.author.userId,
});

const postDefaultError = async (thread: ThreadHandle) => {
  await thread.post(DEFAULT_ERROR_MESSAGE);
};

const handleGatewayMessage = async (
  thread: ThreadHandle,
  message: ThreadMessage,
  requestKind: GatewayRequestKind,
  dependencies: GatewayMessageProcessorDependencies
) => {
  const { bot, chatResponse, logger } = dependencies;
  const log = registerContextLog(thread, message, logger);

  if (requestKind === "mention") {
    await thread.subscribe();
  }

  const platform = parseThreadPlatform(thread.id);
  if (!platform) {
    log.warn("Gateway message ignored because platform is invalid", {
      error: {
        code: "CHAT_PLATFORM_INVALID",
        fix: "Use thread IDs formatted as '<platform>:<id>' with a known platform prefix.",
        why: "The incoming thread id does not include a known platform.",
      },
    });
    await postDefaultError(thread);
    return;
  }

  log.set({
    platform,
    request: {
      kind: requestKind,
    },
  });

  const context = buildMessageContext(bot, platform, thread, message);
  const result = await safeHandleMessage(chatResponse, context);

  if (result.isErr()) {
    log.error("Failed to handle gateway message", {
      error: {
        code: result.error.code,
        message: result.error.message,
        type: result.error.name,
        why: "Chat response pipeline failed while generating a reply.",
        fix: "Inspect AI provider, hooks, MCP servers, and database availability.",
      },
    });
    await postDefaultError(thread);
    return;
  }

  log.set({
    outcome: {
      status: "success",
    },
    response: {
      length: result.value.text.length,
    },
  });

  await thread.post(result.value.text);
};

export const registerGatewayMessageHandlers = (
  gateway: ChatGatewayService,
  dependencies: GatewayMessageProcessorDependencies
) => {
  gateway.registerHandlers({
    onNewMention: (thread, message) =>
      handleGatewayMessage(thread, message, "mention", dependencies),
    onSubscribedMessage: (thread, message) =>
      handleGatewayMessage(thread, message, "subscribed-message", dependencies),
  });
};
