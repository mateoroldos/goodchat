import { Result } from "better-result";
import type { BotConfig, Platform } from "../config/models";
import { DefaultChatGatewayService } from "../gateway/chat-gateway.service";
import type { ChatGatewayHandlers } from "../gateway/chat-gateway.service.interface";
import type { MessageStoreService } from "../message-store/message-store.service.interface";
import { BotInputInvalidError } from "../response-handler/errors";
import { DefaultResponseGeneratorService } from "../response-handler/response-generator.service";
import { DefaultResponseHandlerService } from "../response-handler/response-handler.service";
import { ChatRuntimeInitializationError } from "./errors";

export interface ChatRuntime {
  gateway: DefaultChatGatewayService;
  responseHandler: DefaultResponseHandlerService;
}

const DEFAULT_ERROR_MESSAGE = "Sorry, I ran into an error while responding.";

const resolvePlatform = (
  botConfig: BotConfig,
  threadId: string
): Platform | null => {
  const [platform] = threadId.split(":");
  if (!platform) {
    return null;
  }

  return botConfig.platforms.includes(platform as Platform)
    ? (platform as Platform)
    : null;
};

export const createChatRuntime = (
  botConfig: BotConfig,
  messageStore: MessageStoreService
) => {
  try {
    const gateway = new DefaultChatGatewayService({
      userName: botConfig.name,
      platforms: botConfig.platforms,
    });

    const responseGenerator = new DefaultResponseGeneratorService();
    const responseHandler = new DefaultResponseHandlerService({
      responseGenerator,
      messageStore,
    });

    const handleIncomingMessage: NonNullable<
      ChatGatewayHandlers["onNewMention"]
    > = async (thread, message) => {
      await thread.subscribe();

      const platform = resolvePlatform(botConfig, thread.id);
      if (!platform) {
        await thread.post(DEFAULT_ERROR_MESSAGE);
        return;
      }

      const result = await responseHandler.handleMessage(
        {
          adapterName: platform,
          botConfig,
          platform,
          threadId: thread.id,
          userId: message.author.userId,
        },
        { text: message.text }
      );

      if (result.isErr()) {
        if (result.error instanceof BotInputInvalidError) {
          await thread.post(DEFAULT_ERROR_MESSAGE);
          return;
        }

        await thread.post(DEFAULT_ERROR_MESSAGE);
        return;
      }

      await thread.post(result.value.text);
    };

    const handleSubscribedMessage: NonNullable<
      ChatGatewayHandlers["onSubscribedMessage"]
    > = async (thread, message) => {
      const platform = resolvePlatform(botConfig, thread.id);
      if (!platform) {
        await thread.post(DEFAULT_ERROR_MESSAGE);
        return;
      }

      const result = await responseHandler.handleMessage(
        {
          adapterName: platform,
          botConfig,
          platform,
          threadId: thread.id,
          userId: message.author.userId,
        },
        { text: message.text }
      );

      if (result.isErr()) {
        if (result.error instanceof BotInputInvalidError) {
          await thread.post(DEFAULT_ERROR_MESSAGE);
          return;
        }

        await thread.post(DEFAULT_ERROR_MESSAGE);
        return;
      }

      await thread.post(result.value.text);
    };

    gateway.registerHandlers({
      onNewMention: handleIncomingMessage,
      onSubscribedMessage: handleSubscribedMessage,
    });

    return Result.ok<ChatRuntime, ChatRuntimeInitializationError>({
      gateway,
      responseHandler,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize chat runtime";
    return Result.err(
      new ChatRuntimeInitializationError(message, undefined, error)
    );
  }
};
