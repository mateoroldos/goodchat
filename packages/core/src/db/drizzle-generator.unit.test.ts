import type { GoodchatSchema } from "@goodchat/contracts/db/types";
import { describe, expect, it } from "vitest";
import { generateDrizzleSchema } from "./drizzle-generator";
import { getGoodchatTables } from "./get-tables";

const singleTable = (
  columns: GoodchatSchema["x"]["columns"]
): GoodchatSchema => ({
  myTable: { tableName: "my_table", columns },
});

describe("generateDrizzleSchema", () => {
  describe("field types — sqlite", () => {
    it("string → text", () => {
      const out = generateDrizzleSchema(
        singleTable({ name: { type: "string" } }),
        "sqlite"
      );
      expect(out).toContain(`text("name")`);
    });

    it("number → integer", () => {
      const out = generateDrizzleSchema(
        singleTable({ count: { type: "number" } }),
        "sqlite"
      );
      expect(out).toContain(`integer("count")`);
    });

    it("boolean → integer mode boolean", () => {
      const out = generateDrizzleSchema(
        singleTable({ active: { type: "boolean" } }),
        "sqlite"
      );
      expect(out).toContain(`integer("active", { mode: "boolean" })`);
    });

    it("date → integer mode timestamp_ms", () => {
      const out = generateDrizzleSchema(
        singleTable({ createdAt: { type: "date" } }),
        "sqlite"
      );
      expect(out).toContain(`integer("created_at", { mode: "timestamp_ms" })`);
    });

    it("json → text mode json", () => {
      const out = generateDrizzleSchema(
        singleTable({ data: { type: "json" } }),
        "sqlite"
      );
      expect(out).toContain(`text("data", { mode: "json" })`);
    });
  });

  describe("field types — postgres", () => {
    it("string → text", () => {
      const out = generateDrizzleSchema(
        singleTable({ name: { type: "string" } }),
        "postgres"
      );
      expect(out).toContain(`text("name")`);
    });

    it("number → integer", () => {
      const out = generateDrizzleSchema(
        singleTable({ count: { type: "number" } }),
        "postgres"
      );
      expect(out).toContain(`integer("count")`);
    });

    it("boolean → boolean", () => {
      const out = generateDrizzleSchema(
        singleTable({ active: { type: "boolean" } }),
        "postgres"
      );
      expect(out).toContain(`boolean("active")`);
    });

    it("date → timestamp", () => {
      const out = generateDrizzleSchema(
        singleTable({ createdAt: { type: "date" } }),
        "postgres"
      );
      expect(out).toContain(`timestamp("created_at")`);
    });

    it("json → jsonb", () => {
      const out = generateDrizzleSchema(
        singleTable({ data: { type: "json" } }),
        "postgres"
      );
      expect(out).toContain(`jsonb("data")`);
    });
  });

  describe("field types — mysql", () => {
    it("string → text", () => {
      const out = generateDrizzleSchema(
        singleTable({ name: { type: "string" } }),
        "mysql"
      );
      expect(out).toContain(`text("name")`);
    });

    it("number → int", () => {
      const out = generateDrizzleSchema(
        singleTable({ count: { type: "number" } }),
        "mysql"
      );
      expect(out).toContain(`int("count")`);
    });

    it("boolean → boolean", () => {
      const out = generateDrizzleSchema(
        singleTable({ active: { type: "boolean" } }),
        "mysql"
      );
      expect(out).toContain(`boolean("active")`);
    });

    it("date → timestamp", () => {
      const out = generateDrizzleSchema(
        singleTable({ createdAt: { type: "date" } }),
        "mysql"
      );
      expect(out).toContain(`timestamp("created_at")`);
    });

    it("json → json", () => {
      const out = generateDrizzleSchema(
        singleTable({ data: { type: "json" } }),
        "mysql"
      );
      expect(out).toContain(`json("data")`);
    });
  });

  describe("column modifiers", () => {
    it("required: false → no .notNull()", () => {
      const out = generateDrizzleSchema(
        singleTable({ name: { type: "string", required: false } }),
        "sqlite"
      );
      expect(out).not.toContain(".notNull()");
    });

    it("required: true (default) → .notNull()", () => {
      const out = generateDrizzleSchema(
        singleTable({ name: { type: "string" } }),
        "sqlite"
      );
      expect(out).toContain(".notNull()");
    });

    it("unique: true → .unique()", () => {
      const out = generateDrizzleSchema(
        singleTable({ email: { type: "string", unique: true } }),
        "sqlite"
      );
      expect(out).toContain(".unique()");
    });

    it("columnName override → uses override as DB column", () => {
      const out = generateDrizzleSchema(
        singleTable({ userId: { type: "string", columnName: "user_id" } }),
        "sqlite"
      );
      expect(out).toContain(`text("user_id")`);
    });

    it("camelCase key without columnName → auto snake_case", () => {
      const out = generateDrizzleSchema(
        singleTable({ createdAt: { type: "string" } }),
        "sqlite"
      );
      expect(out).toContain(`text("created_at")`);
    });

    it('string default → .default("value")', () => {
      const out = generateDrizzleSchema(
        singleTable({ role: { type: "string", default: "user" } }),
        "sqlite"
      );
      expect(out).toContain(`.default("user")`);
    });

    it("boolean default → .default(false)", () => {
      const out = generateDrizzleSchema(
        singleTable({ active: { type: "boolean", default: false } }),
        "sqlite"
      );
      expect(out).toContain(".default(false)");
    });
  });

  describe("references", () => {
    it("generates .references() with cascade", () => {
      const out = generateDrizzleSchema(
        singleTable({
          threadId: {
            type: "string",
            references: { model: "threads", field: "id", onDelete: "cascade" },
          },
        }),
        "sqlite"
      );
      expect(out).toContain(
        `.references(() => threads.id, { onDelete: "cascade" })`
      );
    });

    it("defaults onDelete to cascade when not specified", () => {
      const out = generateDrizzleSchema(
        singleTable({
          threadId: {
            type: "string",
            references: { model: "threads", field: "id" },
          },
        }),
        "sqlite"
      );
      expect(out).toContain(`{ onDelete: "cascade" }`);
    });
  });

  describe("schema structure", () => {
    it("emits correct table function per dialect", () => {
      expect(
        generateDrizzleSchema(singleTable({ x: { type: "string" } }), "sqlite")
      ).toContain("sqliteTable");
      expect(
        generateDrizzleSchema(
          singleTable({ x: { type: "string" } }),
          "postgres"
        )
      ).toContain("pgTable");
      expect(
        generateDrizzleSchema(singleTable({ x: { type: "string" } }), "mysql")
      ).toContain("mysqlTable");
    });

    it("emits id primary key for each dialect", () => {
      expect(
        generateDrizzleSchema(singleTable({ x: { type: "string" } }), "sqlite")
      ).toContain(`text("id").primaryKey()`);
      expect(
        generateDrizzleSchema(
          singleTable({ x: { type: "string" } }),
          "postgres"
        )
      ).toContain(`text("id").primaryKey()`);
      expect(
        generateDrizzleSchema(singleTable({ x: { type: "string" } }), "mysql")
      ).toContain(`varchar("id", { length: 191 }).primaryKey()`);
    });

    it("emits composed schema export", () => {
      const out = generateDrizzleSchema(
        singleTable({ x: { type: "string" } }),
        "sqlite"
      );
      expect(out).toContain("export const schema = {");
      expect(out).toContain("myTable");
    });

    it("emits all four core tables for sqlite", () => {
      const out = generateDrizzleSchema(getGoodchatTables([]), "sqlite");
      expect(out).toContain("threads");
      expect(out).toContain("messages");
      expect(out).toContain("aiRuns");
      expect(out).toContain("aiRunToolCalls");
    });

    it("plugin table included after getGoodchatTables merge", () => {
      const out = generateDrizzleSchema(
        getGoodchatTables([
          { schema: { todos: { columns: { title: { type: "string" } } } } },
        ]),
        "sqlite"
      );
      expect(out).toContain("todos");
      expect(out).toContain("threads");
    });

    it("uses tableName override in sqliteTable call", () => {
      const out = generateDrizzleSchema(
        {
          aiRuns: {
            tableName: "ai_runs",
            columns: { mode: { type: "string" } },
          },
        },
        "sqlite"
      );
      expect(out).toContain(`sqliteTable("ai_runs"`);
    });

    it("sorts tables by order", () => {
      const schema: GoodchatSchema = {
        b: { order: 2, columns: { x: { type: "string" } } },
        a: { order: 1, columns: { x: { type: "string" } } },
      };
      const out = generateDrizzleSchema(schema, "sqlite");
      expect(out.indexOf("export const a")).toBeLessThan(
        out.indexOf("export const b")
      );
    });
  });
});
