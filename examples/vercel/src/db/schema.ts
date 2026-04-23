import { authSchema } from "./auth-schema.js";
import { coreSchema } from "./core-schema.js";
import { pluginSchema } from "./plugins/schema.js";

export * from "./auth-schema.js";
export * from "./core-schema.js";
export * from "./plugins/schema.js";

export const schema = {
  ...coreSchema,
  ...authSchema,
  ...pluginSchema,
};
