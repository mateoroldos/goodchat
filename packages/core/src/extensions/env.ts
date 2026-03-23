import { createEnv } from "@t3-oss/env-core";
import type { ZodObject, output as ZodOutput, ZodRawShape } from "zod";

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
