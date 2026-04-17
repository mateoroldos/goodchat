import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const projectRoot = process.cwd();
const shouldDebug = process.env.DEBUG_TEST_MIGRATIONS === "1";

const tasks = [
  {
    dialect: "postgresql",
    schema: "packages/storage/tests/postgres/schema.ts",
    out: "packages/storage/tests/postgres/drizzle",
  },
  {
    dialect: "mysql",
    schema: "packages/storage/tests/mysql/schema.ts",
    out: "packages/storage/tests/mysql/drizzle",
  },
  {
    dialect: "sqlite",
    schema: "packages/storage/tests/sqlite/schema.ts",
    out: "packages/storage/tests/sqlite/drizzle",
  },
];

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

const sortKeysDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const sorted = {};
    for (const key of keys) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }

  return value;
};

const stableStringify = (value) => JSON.stringify(sortKeysDeep(value));

const normalizeSnapshot = (snapshot) => ({
  version: snapshot.version,
  dialect: snapshot.dialect,
  tables: snapshot.tables,
  enums: snapshot.enums,
  schemas: snapshot.schemas,
  sequences: snapshot.sequences,
  roles: snapshot.roles,
  policies: snapshot.policies,
  views: snapshot.views,
});

const getLatestSnapshotPath = (metaDir) => {
  if (!fs.existsSync(metaDir)) {
    return null;
  }

  const journalPath = path.join(metaDir, "_journal.json");
  if (fs.existsSync(journalPath)) {
    const journal = readJson(journalPath);
    const entries = Array.isArray(journal.entries) ? journal.entries : [];
    const lastEntry = entries.at(-1);
    if (lastEntry?.tag) {
      const journalSnapshot = path.join(
        metaDir,
        `${lastEntry.tag}_snapshot.json`
      );
      if (fs.existsSync(journalSnapshot)) {
        return journalSnapshot;
      }
    }
  }

  const snapshots = fs
    .readdirSync(metaDir)
    .filter((file) => file.endsWith("_snapshot.json"))
    .sort();

  if (snapshots.length === 0) {
    return null;
  }

  return path.join(metaDir, snapshots.at(-1));
};

const debugLog = (...parts) => {
  if (!shouldDebug) {
    return;
  }
  console.log(...parts);
};

const runGenerate = (schemaPath, outPath, dialect) => {
  execFileSync(
    "bunx",
    [
      "drizzle-kit",
      "generate",
      "--schema",
      schemaPath,
      "--out",
      outPath,
      "--dialect",
      dialect,
    ],
    { stdio: "pipe" }
  );
};

const createTempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "goodchat-test-migrations-"));

let hasDiff = false;
const report = [];

for (const task of tasks) {
  const sourceOut = path.resolve(projectRoot, task.out);
  if (!fs.existsSync(sourceOut)) {
    throw new Error(`Missing migration directory: ${task.out}`);
  }

  const tempRoot = createTempDir();
  const tempOut = path.join(tempRoot, path.basename(task.out));

  debugLog(`\n[debug] dialect=${task.dialect}`);
  debugLog(`[debug] schema=${path.resolve(projectRoot, task.schema)}`);
  debugLog(`[debug] sourceOut=${sourceOut}`);
  debugLog(`[debug] tempOut=${tempOut}`);

  runGenerate(path.resolve(projectRoot, task.schema), tempOut, task.dialect);

  const sourceSnapshotPath = getLatestSnapshotPath(
    path.join(sourceOut, "meta")
  );
  const tempSnapshotPath = getLatestSnapshotPath(path.join(tempOut, "meta"));

  if (!(sourceSnapshotPath && tempSnapshotPath)) {
    throw new Error(`Missing snapshot for ${task.out}`);
  }

  const sourceSnapshot = normalizeSnapshot(readJson(sourceSnapshotPath));
  const tempSnapshot = normalizeSnapshot(readJson(tempSnapshotPath));

  debugLog(`[debug] sourceSnapshot=${sourceSnapshotPath}`);
  debugLog(`[debug] tempSnapshot=${tempSnapshotPath}`);

  const isEqual =
    stableStringify(sourceSnapshot) === stableStringify(tempSnapshot);

  if (!isEqual) {
    hasDiff = true;
    report.push({ out: task.out, files: ["schema snapshot differs"] });
    debugLog("[debug] snapshotDiff=true");
  }
}

if (hasDiff) {
  const lines = [
    "Test migrations are out of date.",
    "Update them with:",
    "  bun run test:migrations:update",
    "Differences:",
  ];
  for (const entry of report) {
    lines.push(`- ${entry.out}`);
    for (const file of entry.files) {
      lines.push(`  - ${file}`);
    }
  }
  console.error(lines.join("\n"));
  process.exit(1);
}
