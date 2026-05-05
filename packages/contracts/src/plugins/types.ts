import type { Tool } from "ai";
import type {
  input as ZodInput,
  ZodObject,
  output as ZodOutput,
  ZodRawShape,
  ZodTypeAny,
} from "zod";
import type { MCPServerConfig } from "../capabilities/types";
import type { GoodchatPluginHooks } from "../hooks/types";
import type { SchemaTableDeclaration } from "../schema/types";

export type {
  BotResponse,
  CoreDbCapability,
  GoodchatHooks,
  GoodchatPluginHooks,
  HookContext,
  MessageContext,
} from "../hooks/types";
export type { Logger } from "../logger/types";

export interface GoodchatPlugin<
  TSchema extends
    readonly SchemaTableDeclaration[] = readonly SchemaTableDeclaration[],
> {
  hooks?: GoodchatPluginHooks<TSchema>;
  mcp?: MCPServerConfig[];
  name: string;
  systemPrompt?: string;
  tools?: Record<string, Tool>;
}

// Internal runtime shape after factory/definition resolution.
// This carries metadata used by schema sync + hook DB scoping and is not part
// of the public object plugin schema validated by `goodchatPluginSchema`.
export type GoodchatResolvedPlugin<
  TSchema extends
    readonly SchemaTableDeclaration[] = readonly SchemaTableDeclaration[],
> = GoodchatPlugin<TSchema> & {
  key?: string;
  schema?: TSchema;
};

// Shared metadata for plugin definitions before runtime instantiation.
// `env` and `schema` are static declaration-time concerns; runtime behavior is produced by `create`.
export interface GoodchatPluginDefinitionBase<TShape extends ZodRawShape> {
  env?: ZodObject<TShape>;
  key?: string;
  name: string;
  schema?: readonly SchemaTableDeclaration[];
}

export interface GoodchatPluginInstanceConfig {
  key?: string;
}

// Definition branch for plugins that do not accept params.
// `create` always receives `params` as `undefined` to keep a consistent call shape.
export type GoodchatPluginDefinitionNoParams<TShape extends ZodRawShape> =
  GoodchatPluginDefinitionBase<TShape> & {
    create: (
      env: ZodOutput<ZodObject<TShape>>,
      params: undefined
    ) => Omit<GoodchatPlugin<readonly SchemaTableDeclaration[]>, "name">;
    params?: undefined;
    paramsSchema?: undefined;
  };

// Definition branch for plugins that accept params.
// `params` and `paramsSchema` stay linked through `TParamsSchema` so inference matches runtime validation.
export type GoodchatPluginDefinitionWithParams<
  TShape extends ZodRawShape,
  TParamsSchema extends ZodTypeAny,
> = GoodchatPluginDefinitionBase<TShape> & {
  create: (
    env: ZodOutput<ZodObject<TShape>>,
    params: ZodInput<TParamsSchema>
  ) => Omit<GoodchatPlugin<readonly SchemaTableDeclaration[]>, "name">;
  params: ZodInput<TParamsSchema>;
  paramsSchema: TParamsSchema;
};

// Public definition type that flips between param/no-param variants.
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

// Factory call signature mirrors definition conditionality:
// no params schema -> factory(config?), params schema -> factory(params, config?).
export type GoodchatPluginFactory<
  TShape extends ZodRawShape = ZodRawShape,
  TParamsSchema extends ZodTypeAny | undefined = undefined,
> = TParamsSchema extends ZodTypeAny
  ? (
      params: ZodInput<TParamsSchema>,
      config?: GoodchatPluginInstanceConfig
    ) => GoodchatPluginDefinition<TShape, TParamsSchema>
  : (
      config?: GoodchatPluginInstanceConfig
    ) => GoodchatPluginDefinition<TShape, TParamsSchema>;

export const isPluginDefinition = (
  p: GoodchatPlugin | GoodchatPluginDefinitionAny
): p is GoodchatPluginDefinitionAny => typeof p === "object" && "create" in p;

export const isPluginFactory = (p: unknown): p is GoodchatPluginFactory =>
  typeof p === "function";
