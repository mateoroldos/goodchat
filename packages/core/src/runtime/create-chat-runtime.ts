import type { BotConfig, Platform } from "@goodchat/contracts/config/types";
import type { Database } from "@goodchat/contracts/database/interface";
import type { MessageContext } from "@goodchat/contracts/plugins/types";
import { DefaultAiResponseService } from "../ai-response";
import { DefaultChatResponseService } from "../chat-response";
import type { ChatResponseService } from "../chat-response/interface";
import type { GoodchatExtensions } from "../extensions/models";
import { DefaultChatGatewayService } from "../gateway/index";
import type {
  ChatGatewayHandlers,
  ChatGatewayService,
} from "../gateway/interface";

export interface ChatRuntime {
  gateway: ChatGatewayService;
  responseHandler: ChatResponseService;
}

export const createChatRuntime = (
  botConfig: BotConfig,
  database: Database,
  extensions: GoodchatExtensions
): ChatRuntime => {
  const aiResponse = new DefaultAiResponseService();
  const responseHandler = new DefaultChatResponseService({
    aiResponse,
    botConfig,
    database,
    extensions,
  });

  const gateway = new DefaultChatGatewayService({
    userName: botConfig.name,
    platforms: botConfig.platforms,
  });

  const handleMessage = async (
    thread: ThreadHandle,
    message: ThreadMessage,
    shouldSubscribe: boolean
  ) => {
    if (shouldSubscribe) {
      await thread.subscribe();
    }

    const platform = parsePlatform(thread.id);
    if (!platform) {
      await thread.post(DEFAULT_ERROR_MESSAGE);
      return;
    }

    const context: MessageContext = {
      adapterName: platform,
      botId: botConfig.id,
      botName: botConfig.name,
      platform,
      text: message.text,
      threadId: thread.id,
      userId: message.author.userId,
    };

    const result = await responseHandler.handleMessage(context);
    if (result.isErr()) {
      console.error("Error while handling response:", result.error);
      await thread.post(DEFAULT_ERROR_MESSAGE);
      return;
    }

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
