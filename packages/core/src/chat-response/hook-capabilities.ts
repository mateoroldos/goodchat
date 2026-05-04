import type { Database } from "@goodchat/contracts/database/interface";
import type {
  CoreDbCapability,
  HookDbCapability,
} from "@goodchat/contracts/hooks/types";
import type { SchemaTableDeclaration } from "@goodchat/contracts/schema/types";

const normalize = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const getDrizzleConnection = (database: Database) => {
  const connection = database.connection as {
    delete?: (table: unknown) => {
      execute: () => Promise<unknown>;
      where: (condition: unknown) => { execute: () => Promise<unknown> };
    };
    insert?: (table: unknown) => {
      values: (payload: Record<string, unknown>) => {
        execute: () => Promise<unknown>;
      };
    };
    select?: () => {
      from: (table: unknown) => {
        limit: (count: number) => Promise<unknown[]>;
        where: (condition: unknown) => {
          limit: (count: number) => Promise<unknown[]>;
        };
      };
    };
    update?: (table: unknown) => {
      set: (patch: Record<string, unknown>) => {
        execute: () => Promise<unknown>;
        where: (condition: unknown) => { execute: () => Promise<unknown> };
      };
    };
  };

  if (
    typeof connection?.select !== "function" ||
    typeof connection?.insert !== "function" ||
    typeof connection?.update !== "function" ||
    typeof connection?.delete !== "function"
  ) {
    throw new Error("Hook db capability requires a Drizzle connection.");
  }

  return connection as {
    delete: NonNullable<typeof connection.delete>;
    insert: NonNullable<typeof connection.insert>;
    select: NonNullable<typeof connection.select>;
    update: NonNullable<typeof connection.update>;
  };
};

const unavailableQuery = (): never => {
  throw new Error(
    "query method unavailable: table was not found in the Drizzle query client."
  );
};

const denyUnknownTable = (tableName: string, pluginName: string): never => {
  throw new Error(
    `Hook db capability denied table "${tableName}" for plugin "${pluginName}".`
  );
};

export const createPluginHookCapabilities = <
  TSchema extends readonly SchemaTableDeclaration[],
>(input: {
  database: Database;
  pluginKey?: string;
  pluginName: string;
  schema: TSchema;
}): HookDbCapability<TSchema> => {
  const pluginPrefix = normalize(input.pluginName);
  const keySuffix = input.pluginKey ? normalize(input.pluginKey) : "";
  const prefix = keySuffix ? `${pluginPrefix}_${keySuffix}` : pluginPrefix;
  const schema = input.database.schema ?? {};
  const drizzle = getDrizzleConnection(input.database);

  const tableEntries = input.schema.map((table) => {
    const physical = `${prefix}_${table.tableName}`;
    const resolved = schema[physical] as Record<string, unknown> | undefined;
    if (!resolved) {
      denyUnknownTable(table.tableName, input.pluginName);
    }
    return [table.tableName, resolved] as const;
  });

  const tables = Object.fromEntries(tableEntries);
  const tableSet = new Set<unknown>(Object.values(tables));

  const assertAllowedTable = <TTable>(table: TTable): TTable => {
    if (!tableSet.has(table)) {
      throw new Error(
        `Hook db capability denied access to a table outside plugin "${input.pluginName}" scope.`
      );
    }
    return table;
  };

  const querySource = (input.database.connection as { query?: unknown }).query;
  const query = Object.fromEntries(
    tableEntries.map(([tableName]) => {
      const item =
        querySource && typeof querySource === "object"
          ? (querySource as Record<string, unknown>)[tableName]
          : undefined;
      if (!item || typeof item !== "object") {
        return [
          tableName,
          {
            findFirst: unavailableQuery,
            findMany: unavailableQuery,
          },
        ] as const;
      }

      const typed = item as {
        findFirst?: (...args: unknown[]) => Promise<unknown>;
        findMany?: (...args: unknown[]) => Promise<unknown[]>;
      };
      return [
        tableName,
        {
          findFirst: typed.findFirst ?? unavailableQuery,
          findMany: typed.findMany ?? unavailableQuery,
        },
      ] as const;
    })
  );

  return {
    core: createCoreDbCapability(input.database),
    delete: (table) => drizzle.delete(assertAllowedTable(table)),
    insert: (table) => drizzle.insert(assertAllowedTable(table)),
    query: query as HookDbCapability<TSchema>["query"],
    select: (() => ({
      from: (table) => drizzle.select().from(assertAllowedTable(table)),
    })) as HookDbCapability<TSchema>["select"],
    tables: tables as HookDbCapability<TSchema>["tables"],
    update: (table) => drizzle.update(assertAllowedTable(table)),
  };
};

export const createCoreDbCapability = (
  database: Database
): CoreDbCapability => ({
  aiRunToolCalls: database.aiRunToolCalls,
  aiRuns: database.aiRuns,
  analytics: database.analytics,
  messages: database.messages,
  threads: database.threads,
});
