import type { Bot } from "@goodchat/contracts/config/types";
import { generateText, streamText } from "ai";
import { DefaultAiResponseService } from "../ai-response";
import type { AiTelemetryService } from "../ai-telemetry/interface";
import { DefaultChatResponseService } from "../chat-response";
import type { ChatResponseService } from "../chat-response/interface";
import type { HookRegistration } from "../extensions/models";
import { DefaultChatGatewayService } from "../gateway/index";
import type { ChatGatewayService } from "../gateway/interface";
import type { LoggerService } from "../logger/interface";
import { registerGatewayMessageHandlers } from "./gateway-message-processor";

export interface ChatRuntime {
  chatResponse: ChatResponseService;
  initializeGateway(): Promise<ChatGatewayService>;
}

export const createChatRuntime = ({
  aiTelemetry,
  bot,
  hookRegistrations,
  logger,
}: {
  aiTelemetry: AiTelemetryService;
  bot: Bot;
  hookRegistrations?: HookRegistration[];
  logger: LoggerService;
}): ChatRuntime => {
  const aiResponse = new DefaultAiResponseService(
    { generateText, streamText },
    aiTelemetry
  );
  const chatResponse = new DefaultChatResponseService({
    aiResponse,
    bot,
    hookRegistrations,
    logger,
  });

  let gateway: ChatGatewayService | null = null;
  let initializationPromise: Promise<ChatGatewayService> | null = null;

  const getGateway = () => {
    if (gateway) {
      return gateway;
    }

    const createdGateway = new DefaultChatGatewayService({
      database: bot.database,
      logger,
      userName: bot.name,
      platforms: bot.platforms,
      state: bot.state,
    });

    registerGatewayMessageHandlers(createdGateway, {
      bot,
      chatResponse,
      logger,
    });

    gateway = createdGateway;
    return createdGateway;
  };

  const initializeGateway = () => {
    if (initializationPromise) {
      return initializationPromise;
    }

    initializationPromise = (async () => {
      const createdGateway = getGateway();
      await createdGateway.initialize();
      return createdGateway;
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });

    return initializationPromise;
  };

  return {
    chatResponse,
    initializeGateway,
  };
};
