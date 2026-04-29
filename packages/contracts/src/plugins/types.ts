import type { Tool } from "ai";
import type {
  input as ZodInput,
  ZodObject,
  output as ZodOutput,
  ZodRawShape,
  ZodTypeAny,
} from "zod";
import type { MCPServerConfig } from "../capabilities/types";
import type { GoodchatPluginSchema } from "../db/types";
import type { GoodchatHooks } from "../hooks/types";

export type {
  BotResponse,
  GoodchatHooks,
  HookContext,
  MessageContext,
} from "../hooks/types";
export type { Logger } from "../logger/types";

export interface GoodchatPlugin {
  hooks?: GoodchatHooks;
  mcp?: MCPServerConfig[];
  name: string;
  schema?: GoodchatPluginSchema;
  systemPrompt?: string;
  tools?: Record<string, Tool>;
}

export interface GoodchatPluginDefinitionBase<TShape extends ZodRawShape> {
  env?: ZodObject<TShape>;
  name: string;
  schema?: GoodchatPluginSchema;
}

export type GoodchatPluginDefinitionNoParams<TShape extends ZodRawShape> =
  GoodchatPluginDefinitionBase<TShape> & {
    create: (
      env: ZodOutput<ZodObject<TShape>>,
      params: undefined
    ) => Omit<GoodchatPlugin, "name" | "schema">;
    params?: undefined;
    paramsSchema?: undefined;
  };

export type GoodchatPluginDefinitionWithParams<
  TShape extends ZodRawShape,
  TParamsSchema extends ZodTypeAny,
> = GoodchatPluginDefinitionBase<TShape> & {
  create: (
    env: ZodOutput<ZodObject<TShape>>,
    params: ZodInput<TParamsSchema>
  ) => Omit<GoodchatPlugin, "name" | "schema">;
  params: ZodInput<TParamsSchema>;
  paramsSchema: TParamsSchema;
};

export type GoodchatPluginDefinition<
  TShape extends ZodRawShape = ZodRawShape,
  TParamsSchema extends ZodTypeAny | undefined = undefined,
> = TParamsSchema extends ZodTypeAny
  ? GoodchatPluginDefinitionWithParams<TShape, TParamsSchema>
  : GoodchatPluginDefinitionNoParams<TShape>;

export type GoodchatPluginDefinitionAny = GoodchatPluginDefinition<
  ZodRawShape,
  ZodTypeAny | undefined
>;

export type GoodchatPluginFactory<
  TShape extends ZodRawShape = ZodRawShape,
  TParamsSchema extends ZodTypeAny | undefined = undefined,
> = TParamsSchema extends ZodTypeAny
  ? (
      params: ZodInput<TParamsSchema>
    ) => GoodchatPluginDefinition<TShape, TParamsSchema>
  : (params?: undefined) => GoodchatPluginDefinition<TShape, TParamsSchema>;

export const isPluginDefinition = (
  p: GoodchatPlugin | GoodchatPluginDefinitionAny
): p is GoodchatPluginDefinitionAny => typeof p === "object" && "create" in p;

export const isPluginFactory = (p: unknown): p is GoodchatPluginFactory =>
  typeof p === "function";
