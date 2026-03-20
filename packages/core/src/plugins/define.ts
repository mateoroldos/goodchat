import type { ZodObject, output as ZodOutput, ZodRawShape } from "zod";
import type { GoodbotPlugin, GoodbotPluginDescriptor } from "./models";

export const definePlugin = <TShape extends ZodRawShape>(options: {
  create: (env: ZodOutput<ZodObject<TShape>>) => Omit<GoodbotPlugin, "name">;
  env?: ZodObject<TShape>;
  name: string;
}): GoodbotPluginDescriptor<TShape> => options;
