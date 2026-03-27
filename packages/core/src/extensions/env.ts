import { createEnv } from "@t3-oss/env-core";
import type {
  input as ZodInput,
  ZodObject,
  output as ZodOutput,
  ZodRawShape,
  ZodTypeAny,
} from "zod";

export const validatePluginEnv = <TShape extends ZodRawShape>(
  pluginName: string,
  envSchema: ZodObject<TShape>
): ZodOutput<ZodObject<TShape>> => {
  try {
    // createEnv's return type can't be narrowed through a generic ZodRawShape,
    // so we cast — the runtime value is correctly validated by zod internally.
    return createEnv({
      server: envSchema.shape,
      runtimeEnv: process.env,
      emptyStringAsUndefined: true,
    }) as ZodOutput<ZodObject<TShape>>;
  } catch (error) {
    throw new Error(
      `Plugin "${pluginName}" env validation failed. Check that all required variables are set.`,
      { cause: error }
    );
  }
};

export const validatePluginParams = <TSchema extends ZodTypeAny>(
  pluginName: string,
  paramsSchema: TSchema,
  params: ZodInput<TSchema>
): ZodOutput<TSchema> => {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(
      `Plugin "${pluginName}" params validation failed. Check the plugin configuration values.`,
      { cause: parsed.error }
    );
  }
  return parsed.data;
};
