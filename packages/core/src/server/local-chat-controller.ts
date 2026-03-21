import { createUIMessageStreamResponse } from "ai";
import { Elysia, t } from "elysia";
import type { BotConfig } from "../config/models";
import type { GoodbotExtensions } from "../plugins/models";
import type { ResponseHandlerService } from "../response-handler/response-handler.service.interface";

interface LocalChatControllerOptions {
  botConfig: BotConfig;
  extensions?: GoodbotExtensions;
  responseHandler: ResponseHandlerService;
}

export const localChatController = ({
  botConfig,
  extensions,
  responseHandler,
}: LocalChatControllerOptions) => {
  const controller = new Elysia({ prefix: "/local" });

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
      if (!botConfig.platforms.includes("local")) {
        return status(404, { message: "Local platform not configured" });
      }

      const threadId =
        body.threadId ?? body.id ?? `local:${crypto.randomUUID()}`;
      const userId = body.userId ?? "dashboard-user";
      const messageText = resolveMessageText(body);

      if (!messageText) {
        return status(400, { message: "Message is required" });
      }

      const result = await responseHandler.handleMessage(
        {
          adapterName: "local",
          botConfig,
          platform: "local",
          threadId,
          userId,
        },
        { text: messageText },
        extensions
      );

      if (result.isErr()) {
        return status(500, { message: "Failed to generate response" });
      }

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
      if (!botConfig.platforms.includes("local")) {
        return status(404, { message: "Local platform not configured" });
      }

      const threadId =
        body.threadId ?? body.id ?? `local:${crypto.randomUUID()}`;
      const userId = body.userId ?? "dashboard-user";
      const messageText = resolveMessageText(body);

      if (!messageText) {
        return status(400, { message: "Message is required" });
      }

      const result = await responseHandler.handleMessageStream(
        {
          adapterName: "local",
          botConfig,
          platform: "local",
          threadId,
          userId,
        },
        { text: messageText },
        extensions
      );

      if (result.isErr()) {
        return status(500, { message: "Failed to generate response" });
      }

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
