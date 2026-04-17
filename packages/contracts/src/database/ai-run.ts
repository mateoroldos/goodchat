export interface AiRun {
  assistantMessageId: string;
  createdAt: string;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  finishedAt?: string;
  finishReason?: string;
  hadError: boolean;
  id: string;
  inputTokens?: number;
  mode: "stream" | "sync";
  modelId: string;
  outputTokens?: number;
  provider: string;
  providerMetadata?: Record<string, unknown>;
  threadId: string;
  totalTokens?: number;
  usage?: Record<string, unknown>;
  userId: string;
}

export type AiRunCreate = AiRun;

export type AiRunUpdate = Partial<
  Pick<
    AiRun,
    | "durationMs"
    | "errorCode"
    | "errorMessage"
    | "finishReason"
    | "finishedAt"
    | "hadError"
    | "inputTokens"
    | "outputTokens"
    | "providerMetadata"
    | "totalTokens"
    | "usage"
  >
>;
