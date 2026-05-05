import type { SchemaTableDeclaration } from "@goodchat/contracts/schema/types";
import { describe, expect, it } from "vitest";
import {
  type Dialect,
  emitPluginDrizzleSchema,
  renderColumn,
  renderIndexes,
  renderRelations,
  renderTables,
} from "./schema-foundation";

const dialects = [
  "sqlite",
  "postgres",
  "mysql",
] as const satisfies readonly Dialect[];

const tableWithAllColumnTypes = {
  tableName: "plugin_events",
  columns: [
    { columnName: "id", dataType: "id", primaryKey: true },
    { columnName: "display_name", dataType: "text", notNull: true },
    { columnName: "retry_count", dataType: "integer" },
    { columnName: "payload", dataType: "json" },
    { columnName: "created_at", dataType: "timestamp", notNull: true },
    { columnName: "is_active", dataType: "boolean", notNull: true },
  ],
} as const satisfies SchemaTableDeclaration;

describe("column DSL to Drizzle column expressions", () => {
  it.each([
    ["sqlite", 'id: text("id").primaryKey()'],
    ["postgres", 'id: text("id").primaryKey()'],
    ["mysql", 'id: varchar("id", { length: 191 }).primaryKey()'],
  ] as const)("renders id columns for %s", (dialect, expected) => {
    expect(renderColumn(dialect, tableWithAllColumnTypes.columns[0])).toBe(
      expected
    );
  });

  it.each([
    ["sqlite", 'payload: text("payload", { mode: "json" })'],
    ["postgres", 'payload: jsonb("payload")'],
    ["mysql", 'payload: json("payload")'],
  ] as const)("renders json columns for %s", (dialect, expected) => {
    expect(renderColumn(dialect, tableWithAllColumnTypes.columns[3])).toBe(
      expected
    );
  });

  it.each([
    [
      "sqlite",
      'createdAt: integer("created_at", { mode: "timestamp" }).notNull()',
    ],
    ["postgres", 'createdAt: timestamp("created_at").notNull()'],
    ["mysql", 'createdAt: timestamp("created_at").notNull()'],
  ] as const)("renders timestamp columns for %s", (dialect, expected) => {
    expect(renderColumn(dialect, tableWithAllColumnTypes.columns[4])).toBe(
      expected
    );
  });

  it.each([
    ["sqlite", 'isActive: integer("is_active", { mode: "boolean" }).notNull()'],
    ["postgres", 'isActive: boolean("is_active").notNull()'],
    ["mysql", 'isActive: boolean("is_active").notNull()'],
  ] as const)("renders boolean columns for %s", (dialect, expected) => {
    expect(renderColumn(dialect, tableWithAllColumnTypes.columns[5])).toBe(
      expected
    );
  });

  it("uses explicit property names and chains unique after notNull", () => {
    expect(
      renderColumn("sqlite", {
        columnName: "external_id",
        dataType: "text",
        notNull: true,
        propertyName: "externalIdentifier",
        unique: true,
      })
    ).toBe('externalIdentifier: text("external_id").notNull().unique()');
  });
});

describe("index DSL to Drizzle table index declarations", () => {
  it("renders explicit index names, generated index names, and unique indexes", () => {
    expect(
      renderIndexes("pluginEvents", [
        { columns: ["displayName"], name: "plugin_events_display_name_idx" },
        { columns: ["externalId"], unique: true },
      ])
    ).toBe(
      '  index("plugin_events_display_name_idx").on(t.displayName),\n  uniqueIndex("idx_pluginEvents_externalId").on(t.externalId),'
    );
  });
});

describe("relation DSL to Drizzle relation declarations", () => {
  it("renders one and many relations with camel-cased table variables", () => {
    expect(
      renderRelations({
        tableName: "plugin_events",
        columns: [],
        relations: [
          {
            fields: ["threadId"],
            kind: "one",
            name: "thread",
            references: ["id"],
            targetTable: "threads",
          },
          { kind: "many", name: "attempts", targetTable: "plugin_attempts" },
        ],
      })
    ).toBe(
      "\nexport const pluginEventsRelations = relations(pluginEvents, ({ one, many }) => ({\n  thread: one(threads, { fields: [pluginEvents.threadId], references: [threads.id] }),\n  attempts: many(pluginAttempts),\n}));"
    );
  });

  it("does not render relation declarations for tables without relations", () => {
    expect(renderRelations({ tableName: "plugin_events", columns: [] })).toBe(
      ""
    );
  });
});

describe("table DSL to dialect-specific Drizzle tables", () => {
  it.each([
    ["sqlite", "sqliteTable"],
    ["postgres", "pgTable"],
    ["mysql", "mysqlTable"],
  ] as const)("renders %s tables with the correct table factory", (dialect, factory) => {
    const output = renderTables(dialect, [tableWithAllColumnTypes]);

    expect(output).toContain(
      `export const pluginEvents = ${factory}("plugin_events", {`
    );
    expect(output).toContain('displayName: text("display_name").notNull()');
    expect(output).toContain("export const pluginEvents");
  });

  it("renders table indexes in the drizzle table callback", () => {
    const output = renderTables("sqlite", [
      {
        tableName: "plugin_events",
        columns: [{ columnName: "id", dataType: "id" }],
        indexes: [{ columns: ["id"], unique: true }],
      },
    ]);

    expect(output).toContain(
      '}, (t) => [\n  uniqueIndex("idx_pluginEvents_id").on(t.id),\n]);'
    );
  });
});

describe("plugin schema DSL to complete Drizzle schema files", () => {
  it("returns an empty schema when there are no plugin tables", () => {
    expect(
      emitPluginDrizzleSchema({ declarations: [], dialect: "sqlite" })
    ).toBe("export const pluginSchema = {};\n");
  });

  it.each(
    dialects
  )("emits imports, tables, and schema exports for %s", (dialect) => {
    const output = emitPluginDrizzleSchema({
      declarations: [
        { pluginName: "events", tables: [tableWithAllColumnTypes] },
      ],
      dialect,
    });

    expect(output).toContain("drizzle-orm/");
    expect(output).toContain("export const pluginEvents = ");
    expect(output).toContain(
      "export const pluginSchema = {\n  pluginEvents,\n};\n"
    );
  });

  it.each([
    ["sqlite", 'import { sqliteTable, text } from "drizzle-orm/sqlite-core";'],
    ["postgres", 'import { pgTable, text } from "drizzle-orm/pg-core";'],
    ["mysql", 'import { mysqlTable, text } from "drizzle-orm/mysql-core";'],
  ] as const)("omits unused column, index, and relation imports for %s", (dialect, expectedImport) => {
    const output = emitPluginDrizzleSchema({
      declarations: [
        {
          pluginName: "minimal",
          tables: [
            {
              tableName: "minimal_records",
              columns: [{ columnName: "name", dataType: "text" }],
            },
          ],
        },
      ],
      dialect,
    });

    const [firstLine] = output.split("\n");

    expect(firstLine).toBe(expectedImport);
    expect(output).not.toContain('import { relations } from "drizzle-orm";');
  });

  it("includes index and relation imports only when the DSL needs them", () => {
    const output = emitPluginDrizzleSchema({
      declarations: [
        {
          pluginName: "events",
          tables: [
            {
              tableName: "plugin_events",
              columns: [{ columnName: "id", dataType: "id" }],
              indexes: [{ columns: ["id"] }],
              relations: [
                {
                  kind: "many",
                  name: "attempts",
                  targetTable: "plugin_attempts",
                },
              ],
            },
          ],
        },
      ],
      dialect: "sqlite",
    });

    expect(output).toContain(
      'import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";'
    );
    expect(output).toContain('import { relations } from "drizzle-orm";');
  });
});
