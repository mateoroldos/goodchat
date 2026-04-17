export interface AiRunToolCall {
  aiRunId: string;
  createdAt: string;
  durationMs?: number;
  error?: Record<string, unknown>;
  id: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: "error" | "success";
  toolCallId?: string;
  toolName: string;
}

export type AiRunToolCallCreate = AiRunToolCall;

export type AiRunToolCallUpdate = Partial<
  Pick<AiRunToolCall, "durationMs" | "error" | "output" | "status">
>;
