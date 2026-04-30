import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emitCoreDrizzleSchema } from "../src/scaffold/schema-foundation.ts";

const dir = dirname(fileURLToPath(import.meta.url));
const internalSchemaDir = join(dir, "../src/internal-schema");

await Promise.all(
  ["sqlite", "postgres", "mysql"].map((dialect) =>
    writeFile(
      join(internalSchemaDir, `${dialect}.ts`),
      emitCoreDrizzleSchema(dialect)
    )
  )
);

console.log("Generated internal core schemas from contracts declarations.");
