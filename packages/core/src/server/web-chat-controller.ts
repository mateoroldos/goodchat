import type { Bot } from "@goodchat/contracts/config/types";
import type { MessageContext } from "@goodchat/contracts/plugins/types";
import { createUIMessageStreamResponse } from "ai";
import { Elysia, t } from "elysia";
import type { ChatResponseService } from "../chat-response/interface";
import type { LoggerService } from "../logger/interface";

interface WebChatControllerOptions {
  botId: Bot["id"];
  botName: Bot["name"];
  logger: LoggerService;
  platforms: Bot["platforms"];
  responseHandler: ChatResponseService;
}

export const webChatController = ({
  botId,
  botName,
  logger,
  platforms,
  responseHandler,
}: WebChatControllerOptions) => {
  const controller = new Elysia({ prefix: "/web" });

  const getLatestUserText = (messages: unknown) => {
    if (!Array.isArray(messages)) {
      return "";
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message || typeof message !== "object") {
        continue;
      }

      const role = (message as { role?: string }).role;
      if (role !== "user") {
        continue;
      }

      const parts = (message as { parts?: unknown }).parts;
      if (!Array.isArray(parts)) {
        return "";
      }

      return parts
        .filter(
          (part) =>
            part &&
            typeof part === "object" &&
            (part as { type?: string }).type === "text"
        )
        .map((part) => (part as { text?: string }).text ?? "")
        .join("");
    }

    return "";
  };

  const resolveMessageText = (body: {
    message?: unknown;
    messages?: unknown;
  }) => {
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }

    const latestText = getLatestUserText(body.messages);
    if (latestText.trim()) {
      return latestText;
    }

    return null;
  };

  controller.post(
    "/chat",
    async ({ body, status }) => {
      const log = logger.request();
      log.set({
        request: {
          mode: "sync",
        },
      });

      if (!platforms.includes("web")) {
        log.warn(
          "Local chat endpoint requested while web platform is disabled",
          {
            error: {
              code: "LOCAL_PLATFORM_NOT_CONFIGURED",
              fix: "Enable the 'web' platform in createGoodchat().",
              why: "The request targeted web chat but web is not configured.",
            },
          }
        );
        return status(404, { message: "Web platform not configured" });
      }

      const threadId = body.threadId ?? body.id ?? `web:${crypto.randomUUID()}`;
      const userId = body.userId ?? "dashboard-user";
      const messageText = resolveMessageText(body);

      log.set({
        message: { length: messageText?.length ?? 0 },
        thread: { id: threadId },
        user: { id: userId },
      });

      if (!messageText) {
        log.warn("Web chat request is missing message text", {
          error: {
            code: "LOCAL_CHAT_INPUT_INVALID",
            fix: "Provide 'message' or a user text part in 'messages'.",
            why: "Neither body.message nor messages[] contains user text.",
          },
        });
        return status(400, { message: "Message is required" });
      }

      const context: MessageContext = {
        adapterName: "web",
        botId,
        botName,
        platform: "web",
        text: messageText,
        threadId,
        userId,
      };

      const result = await responseHandler.handleMessage(context);

      if (result.isErr()) {
        log.error("Web chat generation failed", {
          error: {
            code: result.error.code,
            message: result.error.message,
            type: result.error.name,
            why: "Chat response service failed to generate a sync response.",
            fix: "Check model configuration, provider credentials, tools, and MCP servers.",
          },
        });

        return status(500, { message: "Failed to generate response" });
      }

      log.set({
        outcome: { status: "success" },
        response: { length: result.value.text.length },
      });

      return {
        text: result.value.text,
        threadId,
      };
    },
    {
      body: t.Object({
        message: t.Optional(t.String()),
        messages: t.Optional(t.Array(t.Any())),
        id: t.Optional(t.String()),
        trigger: t.Optional(t.String()),
        messageId: t.Optional(t.String()),
        threadId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
    }
  );

  controller.post(
    "/chat/stream",
    async ({ body, status }) => {
      const log = logger.request();
      log.set({
        request: {
          mode: "stream",
        },
      });

      if (!platforms.includes("web")) {
        log.warn(
          "Local stream endpoint requested while web platform is disabled",
          {
            error: {
              code: "LOCAL_PLATFORM_NOT_CONFIGURED",
              fix: "Enable the 'web' platform in createGoodchat().",
              why: "The request targeted web chat stream but web is not configured.",
            },
          }
        );
        return status(404, { message: "Web platform not configured" });
      }

      const threadId = body.threadId ?? body.id ?? `web:${crypto.randomUUID()}`;
      const userId = body.userId ?? "dashboard-user";
      const messageText = resolveMessageText(body);

      log.set({
        message: { length: messageText?.length ?? 0 },
        thread: { id: threadId },
        user: { id: userId },
      });

      if (!messageText) {
        log.warn("Local stream request is missing message text", {
          error: {
            code: "LOCAL_CHAT_INPUT_INVALID",
            fix: "Provide 'message' or a user text part in 'messages'.",
            why: "Neither body.message nor messages[] contains user text.",
          },
        });
        return status(400, { message: "Message is required" });
      }

      const context: MessageContext = {
        adapterName: "web",
        botId,
        botName,
        platform: "web",
        text: messageText,
        threadId,
        userId,
      };

      const result = await responseHandler.handleMessageStream(context);

      if (result.isErr()) {
        log.error("Web stream generation failed", {
          error: {
            code: result.error.code,
            message: result.error.message,
            type: result.error.name,
            why: "Chat response service failed to open the response stream.",
            fix: "Check model configuration, provider credentials, tools, and MCP servers.",
          },
        });

        return status(500, { message: "Failed to generate response" });
      }

      log.set({
        outcome: { status: "streaming" },
      });

      return createUIMessageStreamResponse({
        stream: result.value.uiStream,
        headers: {
          "x-thread-id": threadId,
        },
      });
    },
    {
      body: t.Object({
        message: t.Optional(t.String()),
        messages: t.Optional(t.Array(t.Any())),
        id: t.Optional(t.String()),
        trigger: t.Optional(t.String()),
        messageId: t.Optional(t.String()),
        threadId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
      }),
    }
  );

  return controller;
};
