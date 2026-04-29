import { describe, expect, it } from "vitest";
import { coreSchema } from "./core-schema";
import { getGoodchatTables } from "./get-tables";

describe("getGoodchatTables", () => {
  it("returns core schema when plugins is empty", () => {
    const result = getGoodchatTables([]);
    expect(Object.keys(result)).toEqual(Object.keys(coreSchema));
    expect(result.threads?.columns.botId).toBeDefined();
  });

  it("does not mutate coreSchema", () => {
    getGoodchatTables([
      {
        schema: {
          threads: { columns: { extra: { type: "string" } } },
        },
      },
    ]);
    expect(
      (coreSchema.threads.columns as Record<string, unknown>).extra
    ).toBeUndefined();
  });

  it("adds a new table from a plugin", () => {
    const result = getGoodchatTables([
      {
        schema: {
          todos: {
            columns: { title: { type: "string", required: true } },
          },
        },
      },
    ]);
    expect(result.todos).toBeDefined();
    expect(result.todos?.columns.title?.type).toBe("string");
  });

  it("merges plugin columns into an existing core table", () => {
    const result = getGoodchatTables([
      {
        schema: {
          threads: {
            columns: { tenantId: { type: "string", required: true } },
          },
        },
      },
    ]);
    expect(result.threads?.columns.tenantId).toBeDefined();
    expect(result.threads?.columns.botId).toBeDefined();
  });

  it("later plugin columns overwrite earlier ones on the same table", () => {
    const result = getGoodchatTables([
      { schema: { threads: { columns: { extra: { type: "string" } } } } },
      { schema: { threads: { columns: { extra: { type: "number" } } } } },
    ]);
    expect(result.threads?.columns.extra?.type).toBe("number");
  });

  it("plugins without schema are skipped", () => {
    const result = getGoodchatTables([{}, { schema: undefined }]);
    expect(Object.keys(result)).toEqual(Object.keys(coreSchema));
  });

  it("sets tableName from def when provided", () => {
    const result = getGoodchatTables([
      {
        schema: {
          customTable: {
            tableName: "my_custom_table",
            columns: { value: { type: "string" } },
          },
        },
      },
    ]);
    expect(result.customTable?.tableName).toBe("my_custom_table");
  });

  it("defaults tableName to the key when not provided", () => {
    const result = getGoodchatTables([
      {
        schema: { myPlugin: { columns: { value: { type: "string" } } } },
      },
    ]);
    expect(result.myPlugin?.tableName).toBe("myPlugin");
  });
});
