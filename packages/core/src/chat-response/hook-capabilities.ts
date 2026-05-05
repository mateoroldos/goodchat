import type { Database } from "@goodchat/contracts/database/interface";
import type {
  CoreDbCapability,
  HookDbCapability,
} from "@goodchat/contracts/hooks/types";
import type { SchemaTableDeclaration } from "@goodchat/contracts/schema/types";
import { and, eq, getTableName, gt, gte, lt, lte } from "drizzle-orm";

type ComparisonOp =
  | { gt: unknown }
  | { gte: unknown }
  | { lt: unknown }
  | { lte: unknown };

const isComparisonOp = (value: unknown): value is ComparisonOp =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  ("lt" in value || "lte" in value || "gt" in value || "gte" in value);

const buildComparison = (column: unknown, op: ComparisonOp) => {
  if ("lt" in op) {
    return lt(column as never, op.lt);
  }
  if ("lte" in op) {
    return lte(column as never, op.lte);
  }
  if ("gt" in op) {
    return gt(column as never, op.gt);
  }
  return gte(column as never, (op as { gte: unknown }).gte);
};

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

const denyUnknownTable = (tableName: string, pluginName: string): never => {
  throw new Error(
    `Hook db capability denied table "${tableName}" for plugin "${pluginName}".`
  );
};

const getSchemaEntryByPhysicalName = (
  schema: Record<string, unknown>,
  physicalName: string
): readonly [string, Record<string, unknown>] | undefined => {
  for (const [key, value] of Object.entries(schema)) {
    if (!value || typeof value !== "object") {
      continue;
    }

    try {
      if (getTableName(value as never) === physicalName) {
        return [key, value as Record<string, unknown>] as const;
      }
    } catch {
      // Non-Drizzle values can exist in user-provided schemas; ignore them.
    }
  }

  return undefined;
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
    const direct = schema[physical] as Record<string, unknown> | undefined;
    const entry = direct
      ? ([physical, direct] as const)
      : getSchemaEntryByPhysicalName(schema, physical);
    if (!entry) {
      return denyUnknownTable(table.tableName, input.pluginName);
    }
    const [schemaKey, resolved] = entry;
    return [table.tableName, resolved, schemaKey] as const;
  });

  const tables = Object.fromEntries(
    tableEntries.map(([tableName, table]) => [tableName, table])
  );
  const tableSet = new Set<unknown>(Object.values(tables));

  const assertAllowedTable = <TTable>(table: TTable): TTable => {
    if (!tableSet.has(table)) {
      throw new Error(
        `Hook db capability denied access to a table outside plugin "${input.pluginName}" scope.`
      );
    }
    return table;
  };

  const buildWhere = (table: Record<string, unknown>, where: unknown) => {
    if (!where || typeof where !== "object") {
      return where;
    }

    const conditions = Object.entries(where as Record<string, unknown>)
      .map(([key, value]) => {
        const column = table[key];
        if (!column) {
          return undefined;
        }
        if (isComparisonOp(value)) {
          return buildComparison(column, value);
        }
        return eq(column as never, value);
      })
      .filter((condition) => condition !== undefined);

    if (conditions.length === 0) {
      return undefined;
    }

    return and(...conditions);
  };

  const query = Object.fromEntries(
    tableEntries.map(([tableName, table]) => {
      const applyWhere = (where: unknown) => {
        const selection = drizzle.select().from(table);
        const condition = buildWhere(table, where);
        return condition ? selection.where(condition) : selection;
      };

      return [
        tableName,
        {
          findFirst: async (options?: { where?: unknown }) => {
            const rows = await applyWhere(options?.where).limit(1);
            return rows[0];
          },
          findMany: (options?: { where?: unknown }) =>
            applyWhere(options?.where),
        },
      ] as const;
    })
  );

  return {
    core: createCoreDbCapability(input.database),
    delete: (table) => {
      const scopedTable = assertAllowedTable(table);
      const drizzleTable = scopedTable as Record<string, unknown>;
      const queryBuilder = drizzle.delete(scopedTable);
      return {
        ...queryBuilder,
        execute: queryBuilder.execute.bind(queryBuilder),
        where: (condition: unknown) =>
          queryBuilder.where(buildWhere(drizzleTable, condition) as never),
      } as ReturnType<typeof drizzle.delete>;
    },
    insert: (table) => drizzle.insert(assertAllowedTable(table)),
    query: query as unknown as HookDbCapability<TSchema>["query"],
    select: (() => ({
      from: (table) => drizzle.select().from(assertAllowedTable(table)),
    })) as HookDbCapability<TSchema>["select"],
    tables: tables as HookDbCapability<TSchema>["tables"],
    transaction: (fn) =>
      input.database.transaction((txDb) =>
        fn(
          createPluginHookCapabilities({
            database: txDb,
            pluginKey: input.pluginKey,
            pluginName: input.pluginName,
            schema: input.schema,
          })
        )
      ),
    update: (table) => {
      const scopedTable = assertAllowedTable(table);
      const drizzleTable = scopedTable as Record<string, unknown>;
      const queryBuilder = drizzle.update(scopedTable);
      return {
        ...queryBuilder,
        set: (patch: Record<string, unknown>) => {
          const setBuilder = queryBuilder.set(patch);
          return {
            ...setBuilder,
            execute: setBuilder.execute.bind(setBuilder),
            where: (condition: unknown) =>
              setBuilder.where(buildWhere(drizzleTable, condition) as never),
          };
        },
      } as ReturnType<typeof drizzle.update>;
    },
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
