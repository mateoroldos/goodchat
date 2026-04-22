import type { DatabaseDialect } from "../config/types";
import type { AiRun, AiRunCreate, AiRunUpdate } from "./ai-run";
import type {
  AiRunToolCall,
  AiRunToolCallCreate,
  AiRunToolCallUpdate,
} from "./ai-run-tool-call";
import type { Message, MessageCreate, MessageUpdate } from "./message";
import type { Thread, ThreadCreate, ThreadUpdate } from "./thread";

interface ListCursor {
  createdAt: string;
  id: string;
}

interface ThreadListInput {
  botId: string;
  cursor?: ListCursor;
  limit?: number;
  sort?: "asc" | "desc";
}

interface MessageListInput {
  cursor?: ListCursor;
  limit?: number;
  sort?: "asc" | "desc";
  threadId: string;
}

interface AiRunListInput {
  cursor?: ListCursor;
  limit?: number;
  sort?: "asc" | "desc";
  threadId: string;
}

interface AiRunToolCallListInput {
  aiRunId: string;
  cursor?: ListCursor;
  limit?: number;
  sort?: "asc" | "desc";
}

export interface DayCount {
  count: number;
  date: string;
}

export interface DayTokens {
  date: string;
  tokens: number;
}

export interface WeeklyStats {
  threadsByDay: DayCount[];
  tokensByDay: DayTokens[];
}

export interface Database {
  aiRuns: {
    create: (input: AiRunCreate) => Promise<AiRun>;
    delete: (id: string) => Promise<void>;
    getById: (id: string) => Promise<AiRun | null>;
    listByThread: (input: AiRunListInput) => Promise<AiRun[]>;
    update: (id: string, patch: AiRunUpdate) => Promise<AiRun>;
  };
  aiRunToolCalls: {
    create: (input: AiRunToolCallCreate) => Promise<AiRunToolCall>;
    delete: (id: string) => Promise<void>;
    getById: (id: string) => Promise<AiRunToolCall | null>;
    listByRun: (input: AiRunToolCallListInput) => Promise<AiRunToolCall[]>;
    update: (id: string, patch: AiRunToolCallUpdate) => Promise<AiRunToolCall>;
  };
  analytics: {
    weeklyStats: (botId: string) => Promise<WeeklyStats>;
  };
  connection: unknown;
  dialect: DatabaseDialect;
  messages: {
    create: (input: MessageCreate) => Promise<Message>;
    delete: (id: string) => Promise<void>;
    getById: (id: string) => Promise<Message | null>;
    listByThread: (input: MessageListInput) => Promise<Message[]>;
    update: (id: string, patch: MessageUpdate) => Promise<Message>;
  };
  schema?: Record<string, unknown>;
  threads: {
    create: (input: ThreadCreate) => Promise<Thread>;
    delete: (id: string) => Promise<void>;
    getById: (id: string) => Promise<Thread | null>;
    list: (input: ThreadListInput) => Promise<Thread[]>;
    update: (id: string, patch: ThreadUpdate) => Promise<Thread>;
  };
  transaction: <T>(fn: (database: Database) => Promise<T>) => Promise<T>;
}
