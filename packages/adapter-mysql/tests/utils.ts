import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { Database } from "@goodchat/contracts/database/interface";
import { mysqlSchema, SCHEMA_VERSION } from "@goodchat/core/schema/mysql";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createPool } from "mysql2/promise";
import { createMysqlDatabase } from "../src/client";
import { META_ROW_ID } from "../src/version-check";

export interface TestDatabaseOptions {
  includeMetaRow?: boolean;
  includeMetaTable?: boolean;
  schemaVersion?: string;
}

export interface TestDatabase {
  cleanup: () => Promise<void>;
  database: Database;
}

const buildDatabaseName = () =>
  `goodchat_test_${randomUUID().replace(/-/g, "")}`;

const buildAdminConnectionString = (connectionString: string) => {
  const url = new URL(connectionString);
  url.pathname = "/mysql";
  return url.toString();
};

const buildTestConnectionString = (
  connectionString: string,
  databaseName: string
) => {
  const url = new URL(connectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
};

export const createTestDatabase = async (
  connectionString: string,
  options: TestDatabaseOptions = {}
): Promise<TestDatabase> => {
  const databaseName = buildDatabaseName();
  const adminPool = createPool(buildAdminConnectionString(connectionString));

  await adminPool.query(`CREATE DATABASE \`${databaseName}\``);

  const testPool = createPool(
    buildTestConnectionString(connectionString, databaseName)
  );
  const runDrizzle = drizzle as unknown as (
    pool: unknown,
    config: unknown
  ) => ReturnType<typeof drizzle>;
  const migrationDatabase = runDrizzle(testPool, {
    schema: mysqlSchema,
    mode: "default",
  });
  const migrationsFolder = fileURLToPath(new URL("./drizzle", import.meta.url));
  await migrate(migrationDatabase as unknown as Parameters<typeof migrate>[0], {
    migrationsFolder,
  });

  const includeMetaTable = options.includeMetaTable ?? true;
  if (!includeMetaTable) {
    await testPool.query("DROP TABLE `goodchat_meta`;");
  } else if (options.includeMetaRow ?? true) {
    const schemaVersion = options.schemaVersion ?? SCHEMA_VERSION;
    await testPool.query(
      "INSERT INTO `goodchat_meta` (id, schema_version) VALUES (?, ?);",
      [META_ROW_ID, schemaVersion]
    );
  }

  const cleanup = async () => {
    await testPool.end();
    await adminPool.query(`DROP DATABASE \`${databaseName}\``);
    await adminPool.end();
  };

  return {
    database: createMysqlDatabase({
      connectionString: buildTestConnectionString(
        connectionString,
        databaseName
      ),
      client: testPool,
    }),
    cleanup,
  };
};
