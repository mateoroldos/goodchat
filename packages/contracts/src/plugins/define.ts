import type {
  input as ZodInput,
  ZodObject,
  output as ZodOutput,
  ZodRawShape,
  ZodTypeAny,
} from "zod";
import type { GoodchatPlugin, GoodchatPluginFactory } from "./types";

interface DefinePluginNoParamsOptions<TShape extends ZodRawShape> {
  create: (
    env: ZodOutput<ZodObject<TShape>>,
    params: undefined
  ) => Omit<GoodchatPlugin, "name">;
  env?: ZodObject<TShape>;
  name: string;
  paramsSchema?: undefined;
}

interface DefinePluginWithParamsOptions<
  TShape extends ZodRawShape,
  TParamsSchema extends ZodTypeAny,
> {
  create: (
    env: ZodOutput<ZodObject<TShape>>,
    params: ZodInput<TParamsSchema>
  ) => Omit<GoodchatPlugin, "name">;
  env?: ZodObject<TShape>;
  name: string;
  paramsSchema: TParamsSchema;
}

export function definePlugin<TShape extends ZodRawShape>(
  options: DefinePluginNoParamsOptions<TShape>
): GoodchatPluginFactory<TShape, undefined>;
export function definePlugin<
  TShape extends ZodRawShape,
  TParamsSchema extends ZodTypeAny,
>(
  options: DefinePluginWithParamsOptions<TShape, TParamsSchema>
): GoodchatPluginFactory<TShape, TParamsSchema>;
export function definePlugin(
  options:
    | DefinePluginNoParamsOptions<ZodRawShape>
    | DefinePluginWithParamsOptions<ZodRawShape, ZodTypeAny>
):
  | GoodchatPluginFactory<ZodRawShape, ZodTypeAny>
  | GoodchatPluginFactory<ZodRawShape, undefined> {
  if ("paramsSchema" in options && options.paramsSchema) {
    return (params: ZodInput<ZodTypeAny>) => ({
      create: options.create,
      env: options.env,
      name: options.name,
      params,
      paramsSchema: options.paramsSchema,
    });
  }

  return () => ({
    create: options.create,
    env: options.env,
    name: options.name,
    params: undefined,
    paramsSchema: undefined,
  });
}
