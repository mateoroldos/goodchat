import type { ZodObject, output as ZodOutput, ZodRawShape } from "zod";
import type { GoodbotPlugin, GoodbotPluginDefinition } from "./types";

export const definePlugin = <TShape extends ZodRawShape>(options: {
  create: (env: ZodOutput<ZodObject<TShape>>) => Omit<GoodbotPlugin, "name">;
  env?: ZodObject<TShape>;
  name: string;
}): GoodbotPluginDefinition<TShape> => options;
