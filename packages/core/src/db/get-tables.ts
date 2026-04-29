import type {
  GoodchatPluginSchema,
  GoodchatSchema,
} from "@goodchat/contracts/db/types";
import { coreSchema } from "./core-schema";

export const getGoodchatTables = (
  plugins: Array<{ schema?: GoodchatPluginSchema }>
): GoodchatSchema =>
  plugins.reduce((acc, plugin) => {
    if (!plugin.schema) {
      return acc;
    }
    for (const [key, def] of Object.entries(plugin.schema)) {
      acc[key] = {
        ...def,
        tableName: def.tableName ?? key,
        columns: { ...acc[key]?.columns, ...def.columns },
      };
    }
    return acc;
  }, structuredClone(coreSchema) as GoodchatSchema);
