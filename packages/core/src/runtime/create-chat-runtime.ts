import type { Bot, Platform } from "@goodchat/contracts/config/types";
import type { MessageContext } from "@goodchat/contracts/plugins/types";
import { generateText, streamText } from "ai";
import { DefaultAiResponseService } from "../ai-response";
import type { AiTelemetryService } from "../ai-telemetry/interface";
import { DefaultChatResponseService } from "../chat-response";
import type { ChatResponseService } from "../chat-response/interface";
import { DefaultChatGatewayService } from "../gateway/index";
import type {
  ChatGatewayHandlers,
  ChatGatewayService,
} from "../gateway/interface";
import type { LoggerService } from "../logger/interface";

export interface ChatRuntime {
  gateway: ChatGatewayService;
  responseHandler: ChatResponseService;
}

export const createChatRuntime = ({
  aiTelemetry,
  bot,
  logger,
}: {
  aiTelemetry: AiTelemetryService;
  bot: Bot;
  logger: LoggerService;
}): ChatRuntime => {
  const aiResponse = new DefaultAiResponseService(
    { generateText, streamText },
    aiTelemetry
  );
  const responseHandler = new DefaultChatResponseService({
    aiResponse,
    bot,
    logger,
  });

  const gateway = new DefaultChatGatewayService({
    userName: bot.name,
    platforms: bot.platforms,
  });

  const handleMessage = async (
    thread: ThreadHandle,
    message: ThreadMessage,
    shouldSubscribe: boolean
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

    if (shouldSubscribe) {
      await thread.subscribe();
    }

    const platform = parsePlatform(thread.id);
    if (!platform) {
      log.warn("Gateway message ignored because platform is invalid", {
        error: {
          code: "CHAT_PLATFORM_INVALID",
          fix: "Use thread IDs formatted as '<platform>:<id>'.",
          why: "The incoming thread id does not include a known platform.",
        },
      });
      await thread.post(DEFAULT_ERROR_MESSAGE);
      return;
    }

    log.set({
      platform,
      request: {
        kind: shouldSubscribe ? "mention" : "subscribed-message",
      },
    });

    const context: MessageContext = {
      adapterName: platform,
      botId: bot.id,
      botName: bot.name,
      platform,
      text: message.text,
      threadId: thread.id,
      userId: message.author.userId,
    };

    const result = await responseHandler.handleMessage(context);
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
      await thread.post(DEFAULT_ERROR_MESSAGE);
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

  gateway.registerHandlers({
    onNewMention: (thread, message) => handleMessage(thread, message, true),
    onSubscribedMessage: (thread, message) =>
      handleMessage(thread, message, false),
  });

  return { gateway, responseHandler };
};

const DEFAULT_ERROR_MESSAGE = "Sorry, I ran into an error while responding.";

const parsePlatform = (threadId: string): Platform | null => {
  const [platform] = threadId.split(":");
  return platform ? (platform as Platform) : null;
};

type ThreadHandle = Parameters<
  NonNullable<ChatGatewayHandlers["onNewMention"]>
>[0];
type ThreadMessage = Parameters<
  NonNullable<ChatGatewayHandlers["onNewMention"]>
>[1];
