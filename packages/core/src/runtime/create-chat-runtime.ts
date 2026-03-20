import { Result } from "better-result";
import type { BotConfig, Platform } from "../config/models";
import { DefaultChatGatewayService } from "../gateway/chat-gateway.service";
import type { ChatGatewayHandlers } from "../gateway/chat-gateway.service.interface";
import type { MessageStoreService } from "../message-store/message-store.service.interface";
import type { GoodbotExtensions } from "../plugins/models";
import { BotInputInvalidError } from "../response-handler/errors";
import { DefaultResponseGeneratorService } from "../response-handler/response-generator.service";
import { DefaultResponseHandlerService } from "../response-handler/response-handler.service";
import { ChatRuntimeInitializationError } from "./errors";

export interface ChatRuntime {
  gateway: DefaultChatGatewayService;
  responseHandler: DefaultResponseHandlerService;
}

export const createChatRuntime = (
  botConfig: BotConfig,
  messageStore: MessageStoreService,
  extensions?: GoodbotExtensions
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

    const handleThreadMessage = createThreadMessageHandler({
      botConfig,
      responseHandler,
      extensions,
    });

    const handleIncomingMessage: NonNullable<
      ChatGatewayHandlers["onNewMention"]
    > = async (thread, message) =>
      handleThreadMessage(thread, message, { shouldSubscribe: true });

    const handleSubscribedMessage: NonNullable<
      ChatGatewayHandlers["onSubscribedMessage"]
    > = async (thread, message) =>
      handleThreadMessage(thread, message, { shouldSubscribe: false });

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

const createThreadMessageHandler = (params: {
  botConfig: BotConfig;
  responseHandler: DefaultResponseHandlerService;
  extensions?: GoodbotExtensions;
}) => {
  const { botConfig, responseHandler, extensions } = params;

  return async (
    thread: ThreadHandle,
    message: ThreadMessage,
    options: { shouldSubscribe: boolean }
  ) => {
    if (options.shouldSubscribe) {
      await thread.subscribe();
    }

    const platform = parsePlatform(thread.id);
    if (!platform) {
      await postErrorMessage(thread);
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
      { text: message.text },
      extensions
    );

    if (result.isErr()) {
      if (result.error instanceof BotInputInvalidError) {
        await postErrorMessage(thread);
        return;
      }

      await postErrorMessage(thread);
      return;
    }

    await thread.post(result.value.text);
  };
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

const postErrorMessage = async (thread: ThreadHandle) => {
  await thread.post(DEFAULT_ERROR_MESSAGE);
};
