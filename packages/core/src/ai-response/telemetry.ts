import type {
  AiCallParams,
  AiRunTelemetry,
  AiRunToolCallTelemetry,
} from "./models";

export const buildAiRunTelemetry = ({
  finishedAt,
  mode,
  result,
  startedAt,
  model,
}: {
  finishedAt: Date;
  mode: "stream" | "sync";
  result: Record<string, unknown>;
  startedAt: Date;
  model: NonNullable<AiCallParams["model"]>;
}): AiRunTelemetry => {
  const usage = extractObject(result.totalUsage) ?? extractObject(result.usage);
  const toolCalls = extractToolCalls(result);

  return {
    createdAt: startedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    finishReason:
      extractString(result.finishReason) ??
      extractString(result.rawFinishReason),
    finishedAt: finishedAt.toISOString(),
    hadError: false,
    inputTokens: extractNumber(usage?.inputTokens),
    mode,
    modelId: model.modelId,
    outputTokens: extractNumber(usage?.outputTokens),
    provider: model.provider,
    providerMetadata: extractObject(result.providerMetadata),
    toolCalls,
    totalTokens: extractNumber(usage?.totalTokens),
    usage,
  };
};

export const extractErrorMessage = (event: unknown): string => {
  if (!event || typeof event !== "object") {
    return "Unknown stream error";
  }

  const object = event as { error?: unknown };
  if (object.error instanceof Error) {
    return object.error.message;
  }

  if (typeof object.error === "string") {
    return object.error;
  }

  return "Unknown stream error";
};

const extractToolCalls = (
  result: Record<string, unknown>
): AiRunToolCallTelemetry[] => {
  const { callItems, resultItems } = collectToolItems(result);

  const resultByCallId = new Map<string, Record<string, unknown>>();
  for (const item of resultItems) {
    const object = extractObject(item);
    if (!object) {
      continue;
    }
    const toolCallId =
      extractString(object.toolCallId) ?? extractString(object.callId);
    if (toolCallId) {
      resultByCallId.set(toolCallId, object);
    }
  }

  const createdAt = new Date().toISOString();
  return callItems
    .map((item) => {
      const object = extractObject(item);
      if (!object) {
        return null;
      }
      const toolCallId =
        extractString(object.toolCallId) ?? extractString(object.callId);
      const toolName =
        extractString(object.toolName) ??
        extractString(object.tool) ??
        extractString(object.name);
      if (!toolName) {
        return null;
      }

      const toolResult = toolCallId
        ? resultByCallId.get(toolCallId)
        : undefined;
      return {
        createdAt,
        durationMs: extractNumber(toolResult?.durationMs),
        error:
          extractObject(toolResult?.error) ??
          (extractBool(toolResult?.isError)
            ? { message: "Tool call failed" }
            : undefined),
        input: extractObject(object.input),
        output:
          extractObject(toolResult?.output) ??
          extractObject(toolResult?.result),
        status:
          extractBool(toolResult?.isError) || Boolean(toolResult?.error)
            ? "error"
            : "success",
        ...(toolCallId ? { toolCallId } : {}),
        toolName,
      } as AiRunToolCallTelemetry;
    })
    .filter((value): value is AiRunToolCallTelemetry => Boolean(value));
};

const collectToolItems = (result: Record<string, unknown>) => {
  const callItems = [...extractArray(result.toolCalls)];
  const resultItems = [...extractArray(result.toolResults)];

  for (const step of extractArray(result.steps)) {
    const stepObject = extractObject(step);
    if (!stepObject) {
      continue;
    }
    callItems.push(...extractArray(stepObject.toolCalls));
    resultItems.push(...extractArray(stepObject.toolResults));
  }

  return { callItems, resultItems };
};

const extractObject = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const extractArray = (value: unknown): unknown[] => {
  return Array.isArray(value) ? value : [];
};

const extractNumber = (value: unknown): number | undefined => {
  return typeof value === "number" ? value : undefined;
};

const extractString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const extractBool = (value: unknown): boolean => {
  return value === true;
};
