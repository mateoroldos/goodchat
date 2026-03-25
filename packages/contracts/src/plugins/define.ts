import type { ZodObject, output as ZodOutput, ZodRawShape } from "zod";
import type { GoodchatPlugin, GoodchatPluginDefinition } from "./types";

export const definePlugin = <TShape extends ZodRawShape>(options: {
  create: (env: ZodOutput<ZodObject<TShape>>) => Omit<GoodchatPlugin, "name">;
  env?: ZodObject<TShape>;
  name: string;
}): GoodchatPluginDefinition<TShape> => options;
