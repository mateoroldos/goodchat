import type { AiRunCreate } from "@goodchat/contracts/database/ai-run";
import type { AiRunToolCallCreate } from "@goodchat/contracts/database/ai-run-tool-call";
import type { Database } from "@goodchat/contracts/database/interface";
import type { MessageCreate } from "@goodchat/contracts/database/message";
import type {
  ThreadCreate,
  ThreadUpdate,
} from "@goodchat/contracts/database/thread";
import { nanoid } from "nanoid";
import type { AiRunTelemetry } from "../ai-response/models";
import type { MessageContext } from "../types";
import { toJsonRecord } from "./telemetry-serializer";

interface PersistChatResponseParams {
  context: MessageContext;
  database: Database;
  responseText: string;
  telemetry: AiRunTelemetry;
}

export const persistChatResponse = async ({
  context,
  database,
  responseText,
  telemetry,
}: PersistChatResponseParams) => {
  const timestamp = new Date().toISOString();

  await database.transaction(async (transaction) => {
    const threadId = context.threadId;
    await upsertThread(transaction, context, responseText, timestamp);

    const assistantMessage = await createMessages({
      context,
      database: transaction,
      responseText,
      threadId,
      timestamp,
    });

    await persistAiRun(transaction, {
      assistantMessageId: assistantMessage.id,
      context,
      telemetry,
      threadId,
    });
  });
};

const persistAiRun = async (
  database: Database,
  {
    assistantMessageId,
    context,
    telemetry,
    threadId,
  }: {
    assistantMessageId: string;
    context: MessageContext;
    telemetry: AiRunTelemetry;
    threadId: string;
  }
) => {
  const aiRun = buildAiRun({
    assistantMessageId,
    context,
    telemetry,
    threadId,
  });

  await database.aiRuns.create(aiRun);
  await createAiRunToolCalls(database, aiRun.id, telemetry);
};

const upsertThread = async (
  database: Database,
  context: MessageContext,
  responseText: string,
  timestamp: string
) => {
  const existingThread = await database.threads.getById(context.threadId);
  const baseThread: ThreadUpdate = {
    adapterName: context.adapterName,
    botName: context.botName,
    lastActivityAt: timestamp,
    platform: context.platform,
    responseText,
    text: context.text,
    threadId: context.threadId,
    updatedAt: timestamp,
    userId: context.userId,
  };

  if (existingThread) {
    await database.threads.update(context.threadId, baseThread);
    return;
  }

  const thread: ThreadCreate = {
    adapterName: context.adapterName,
    botName: context.botName,
    createdAt: timestamp,
    id: context.threadId,
    lastActivityAt: timestamp,
    platform: context.platform,
    responseText,
    text: context.text,
    threadId: context.threadId,
    updatedAt: timestamp,
    userId: context.userId,
  };
  await database.threads.create(thread);
};

const createMessages = async ({
  context,
  database,
  responseText,
  threadId,
  timestamp,
}: {
  context: MessageContext;
  database: Database;
  responseText: string;
  threadId: string;
  timestamp: string;
}): Promise<MessageCreate> => {
  const userMessage: MessageCreate = {
    adapterName: context.adapterName,
    createdAt: timestamp,
    id: nanoid(),
    role: "user",
    text: context.text,
    threadId,
    userId: context.userId,
  };
  await database.messages.create(userMessage);

  const assistantMessage: MessageCreate = {
    adapterName: context.adapterName,
    createdAt: timestamp,
    id: nanoid(),
    role: "assistant",
    text: responseText,
    threadId,
    userId: "assistant",
  };
  await database.messages.create(assistantMessage);
  return assistantMessage;
};

const buildAiRun = ({
  assistantMessageId,
  context,
  telemetry,
  threadId,
}: {
  assistantMessageId: string;
  context: MessageContext;
  telemetry: AiRunTelemetry;
  threadId: string;
}): AiRunCreate => {
  const providerMetadata = toJsonRecord(telemetry.providerMetadata);
  const usage = toJsonRecord(telemetry.usage);

  const aiRun: AiRunCreate = {
    assistantMessageId,
    createdAt: telemetry.createdAt,
    hadError: telemetry.hadError,
    id: nanoid(),
    mode: telemetry.mode,
    modelId: telemetry.modelId,
    provider: telemetry.provider,
    threadId,
    userId: context.userId,
  };

  if (typeof telemetry.durationMs === "number") {
    aiRun.durationMs = telemetry.durationMs;
  }

  if (telemetry.errorCode) {
    aiRun.errorCode = telemetry.errorCode;
  }

  if (telemetry.errorMessage) {
    aiRun.errorMessage = telemetry.errorMessage;
  }

  if (telemetry.finishReason) {
    aiRun.finishReason = telemetry.finishReason;
  }

  if (telemetry.finishedAt) {
    aiRun.finishedAt = telemetry.finishedAt;
  }

  if (typeof telemetry.inputTokens === "number") {
    aiRun.inputTokens = telemetry.inputTokens;
  }

  if (typeof telemetry.outputTokens === "number") {
    aiRun.outputTokens = telemetry.outputTokens;
  }

  if (providerMetadata) {
    aiRun.providerMetadata = providerMetadata;
  }

  if (typeof telemetry.totalTokens === "number") {
    aiRun.totalTokens = telemetry.totalTokens;
  }

  if (usage) {
    aiRun.usage = usage;
  }

  return aiRun;
};

const createAiRunToolCalls = async (
  database: Database,
  aiRunId: string,
  telemetry: AiRunTelemetry
) => {
  for (const toolCall of telemetry.toolCalls) {
    const error = toJsonRecord(toolCall.error);
    const input = toJsonRecord(toolCall.input);
    const output = toJsonRecord(toolCall.output);

    const aiRunToolCall: AiRunToolCallCreate = {
      aiRunId,
      createdAt: toolCall.createdAt,
      id: nanoid(),
      status: toolCall.status,
      toolName: toolCall.toolName,
    };

    if (typeof toolCall.durationMs === "number") {
      aiRunToolCall.durationMs = toolCall.durationMs;
    }

    if (error) {
      aiRunToolCall.error = error;
    }

    if (input) {
      aiRunToolCall.input = input;
    }

    if (output) {
      aiRunToolCall.output = output;
    }

    if (toolCall.toolCallId) {
      aiRunToolCall.toolCallId = toolCall.toolCallId;
    }

    await database.aiRunToolCalls.create(aiRunToolCall);
  }
};
