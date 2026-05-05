import type { Platform } from "../config/types";
import type { Database } from "../database/interface";
import type { Logger } from "../logger/types";
import type {
  SchemaColumnDeclaration,
  SchemaColumnType,
  SchemaTableDeclaration,
} from "../schema/types";

export interface MessageContext {
  adapterName: string;
  botId: string;
  botName: string;
  platform: Platform;
  text: string;
  threadId: string;
  userId: string;
}

export interface HookTelemetry {
  durationMs?: number;
  finishReason?: string;
  inputTokens?: number;
  modelId: string;
  outputTokens?: number;
  provider: string;
  totalTokens?: number;
}

export interface BotResponse {
  telemetry?: HookTelemetry;
  text: string;
}

type HookTableName<TSchema extends readonly SchemaTableDeclaration[]> = Extract<
  TSchema[number]["tableName"],
  string
>;

type HookTableMap<TSchema extends readonly SchemaTableDeclaration[]> = {
  [TName in HookTableName<TSchema>]: unknown;
};

type HookColumnRuntimeType<TDataType extends SchemaColumnType> =
  TDataType extends "boolean"
    ? boolean
    : TDataType extends "integer"
      ? number
      : TDataType extends "json"
        ? unknown
        : TDataType extends "timestamp"
          ? string | Date
          : string;

type HookColumnKey<TColumn extends SchemaColumnDeclaration> =
  TColumn["propertyName"] extends string
    ? TColumn["propertyName"]
    : TColumn["columnName"];

type HookTableByName<
  TSchema extends readonly SchemaTableDeclaration[],
  TName extends HookTableName<TSchema>,
> = Extract<TSchema[number], { tableName: TName }>;

type HookRowForTable<
  TSchema extends readonly SchemaTableDeclaration[],
  TName extends HookTableName<TSchema>,
> = {
  [TColumn in HookTableByName<
    TSchema,
    TName
  >["columns"][number] as HookColumnKey<TColumn>]: HookColumnRuntimeType<
    TColumn["dataType"]
  >;
};

export interface HookDbCapability<
  TSchema extends
    readonly SchemaTableDeclaration[] = readonly SchemaTableDeclaration[],
> {
  core: CoreDbCapability;
  delete: <TName extends HookTableName<TSchema>>(
    table: HookTableMap<TSchema>[TName]
  ) => {
    execute: () => Promise<unknown>;
    where: (condition: unknown) => { execute: () => Promise<unknown> };
  };
  insert: <TName extends HookTableName<TSchema>>(
    table: HookTableMap<TSchema>[TName]
  ) => {
    values: (payload: Partial<HookRowForTable<TSchema, TName>>) => {
      execute: () => Promise<unknown>;
    };
  };
  query: {
    [TName in HookTableName<TSchema>]: {
      findFirst: (
        ...args: unknown[]
      ) => Promise<HookRowForTable<TSchema, TName> | undefined>;
      findMany: (
        ...args: unknown[]
      ) => Promise<HookRowForTable<TSchema, TName>[]>;
    };
  };
  select: () => {
    from: <TName extends HookTableName<TSchema>>(
      table: HookTableMap<TSchema>[TName]
    ) => {
      limit: (count: number) => Promise<HookRowForTable<TSchema, TName>[]>;
      where: (condition: unknown) => {
        limit: (count: number) => Promise<HookRowForTable<TSchema, TName>[]>;
      };
    };
  };
  tables: HookTableMap<TSchema>;
  transaction: <T>(
    fn: (db: HookDbCapability<TSchema>) => Promise<T>
  ) => Promise<T>;
  update: <TName extends HookTableName<TSchema>>(
    table: HookTableMap<TSchema>[TName]
  ) => {
    set: (patch: Partial<HookRowForTable<TSchema, TName>>) => {
      execute: () => Promise<unknown>;
      where: (condition: unknown) => { execute: () => Promise<unknown> };
    };
  };
}

export interface HookContext extends MessageContext {
  log: Logger;
}

// All five core repositories. Excludes Database internals (connection, dialect, schema, transaction).
export type CoreDbCapability = Pick<
  Database,
  "aiRunToolCalls" | "aiRuns" | "analytics" | "messages" | "threads"
>;

// Bot-level hooks: full access to core tables.
export type BotAfterMessageHook = (
  context: HookContext,
  response: BotResponse,
  db: CoreDbCapability
) => Promise<void>;

export type BotBeforeMessageHook = (
  context: HookContext,
  db: CoreDbCapability
) => Promise<void>;

// Plugin-level hooks: Drizzle access to declared schema tables + same CoreDbCapability as bot hooks via db.core.
export type PluginAfterMessageHook<
  TSchema extends
    readonly SchemaTableDeclaration[] = readonly SchemaTableDeclaration[],
> = (
  context: HookContext,
  response: BotResponse,
  db: HookDbCapability<TSchema>
) => Promise<void>;

export type PluginBeforeMessageHook<
  TSchema extends
    readonly SchemaTableDeclaration[] = readonly SchemaTableDeclaration[],
> = (context: HookContext, db: HookDbCapability<TSchema>) => Promise<void>;

export interface GoodchatHooks {
  afterMessage?: BotAfterMessageHook;
  beforeMessage?: BotBeforeMessageHook;
}

export interface GoodchatPluginHooks<
  TSchema extends
    readonly SchemaTableDeclaration[] = readonly SchemaTableDeclaration[],
> {
  afterMessage?: PluginAfterMessageHook<TSchema>;
  beforeMessage?: PluginBeforeMessageHook<TSchema>;
}
