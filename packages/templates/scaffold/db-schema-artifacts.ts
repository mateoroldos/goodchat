import type { GoodchatPluginSchema } from "@goodchat/contracts/db/types";
import { generateDrizzleSchema } from "@goodchat/core/db/drizzle-generator";
import { getGoodchatTables } from "@goodchat/core/db/get-tables";
import { getAuthSchema } from "./get-auth-schema";

export type DatabaseDialect = "sqlite" | "postgres" | "mysql";

const IMPORT_BLOCK_REGEX = /^import\s+\{([\s\S]*?)\}\s+from\s+"([^"]+)";\n\n/;

const getDrizzleDialect = (dialect: DatabaseDialect): string => {
  if (dialect === "postgres") {
    return "postgresql";
  }
  return dialect;
};

const extractImportBlock = (
  source: string
): {
  imports: Set<string>;
  moduleName: string;
  remainder: string;
} => {
  const match = source.match(IMPORT_BLOCK_REGEX);
  if (!match) {
    throw new Error("Schema block missing drizzle import statement.");
  }

  const names = match[1];
  const moduleName = match[2];
  if (!moduleName) {
    throw new Error("Schema import block is malformed.");
  }
  const imports = new Set(
    (names ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name.length > 0)
  );

  return {
    imports,
    moduleName,
    remainder: source.replace(IMPORT_BLOCK_REGEX, "").trim(),
  };
};

const renderImportBlock = (
  moduleName: string,
  imports: Set<string>
): string => {
  const names = [...imports].sort((a, b) => a.localeCompare(b));
  return `import { ${names.join(", ")} } from "${moduleName}";`;
};

const TABLE_EXPORT_REGEX = /^export const\s+([A-Za-z_$][\w$]*)\s*=\s*/gm;
const NON_TABLE_EXPORTS = new Set(["authSchema", "coreSchema", "schema"]);

const extractTableExports = (source: string): Set<string> => {
  const keys = new Set<string>();
  for (const match of source.matchAll(TABLE_EXPORT_REGEX)) {
    const key = match[1];
    if (!key || NON_TABLE_EXPORTS.has(key)) {
      continue;
    }
    keys.add(key);
  }
  return keys;
};

const renderUnifiedSchemaFile = (input: {
  authEnabled: boolean;
  dialect: DatabaseDialect;
  plugins?: Array<{ schema?: GoodchatPluginSchema }>;
}): string => {
  const merged = getGoodchatTables(input.plugins ?? []);
  const coreAndPluginSchema = generateDrizzleSchema(
    merged,
    input.dialect,
    "coreSchema"
  );
  const authSchema = getAuthSchema(input);

  const coreImport = extractImportBlock(coreAndPluginSchema);
  const authImport = extractImportBlock(authSchema);

  if (coreImport.moduleName !== authImport.moduleName) {
    throw new Error(
      `Auth and core schema imports do not match for ${input.dialect}.`
    );
  }

  const mergedImports = new Set([...coreImport.imports, ...authImport.imports]);
  const importLine = renderImportBlock(coreImport.moduleName, mergedImports);

  const authTables = extractTableExports(authImport.remainder);
  const coreTables = extractTableExports(coreImport.remainder);
  const collisions = [...authTables].filter((name) => coreTables.has(name));
  if (collisions.length > 0) {
    const sorted = collisions.sort((a, b) => a.localeCompare(b));
    throw new Error(
      `Auth and plugin/core schema table keys overlap: ${sorted.join(", ")}. Rename plugin tables to avoid collisions.`
    );
  }

  return `${importLine}\n\n${authImport.remainder}\n\n${coreImport.remainder}\n\nexport const schema = {\n  ...authSchema,\n  ...coreSchema,\n};\n`;
};

export const renderDbSchemaArtifacts = (input: {
  authEnabled: boolean;
  dialect: DatabaseDialect;
  plugins?: Array<{ schema?: GoodchatPluginSchema }>;
  cwd?: string;
}): Promise<Record<string, string>> => {
  return Promise.resolve({
    "drizzle.config.ts": `import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "${getDrizzleDialect(input.dialect)}",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
`,
    "src/db/schema.ts": renderUnifiedSchemaFile(input),
  });
};
