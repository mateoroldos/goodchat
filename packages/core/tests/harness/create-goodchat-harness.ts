import { Database as BunSqliteDatabase } from "bun:sqlite";
import { rm } from "node:fs/promises";
import { authSchema } from "@goodchat/storage/schema/auth/sqlite";
import { sqliteSchema } from "@goodchat/storage/schema/sqlite";
import { sqlite } from "@goodchat/storage/sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { SHARED_AUTH_EMAIL } from "../../src/auth/better-auth";
import { createGoodchat } from "../../src/index";
import { generateSqliteMigrationFromTemplateSchemas } from "./generate-sqlite-migration";

const DEFAULT_AUTH_SECRET = "integration-test-secret";
const DEFAULT_AUTH_PASSWORD = "super-secret-password";

export interface CreateGoodchatHarnessOptions {
  authPassword?: string;
}

export interface GoodchatHarness {
  app: Awaited<ReturnType<typeof createGoodchat>["ready"]>["app"];
  authPassword: string;
  close: () => Promise<void>;
  sharedEmail: string;
}

export const createGoodchatHarness = async (
  options: CreateGoodchatHarnessOptions = {}
): Promise<GoodchatHarness> => {
  const authPassword = options.authPassword ?? DEFAULT_AUTH_PASSWORD;
  const { migrationsFolder, tempDirectory } =
    await generateSqliteMigrationFromTemplateSchemas();

  process.env.GOODCHAT_AUTH_SECRET = DEFAULT_AUTH_SECRET;
  process.env.OPENAI_API_KEY = "test-openai-key";
  const client = new BunSqliteDatabase(":memory:");

  migrate(drizzle(client), {
    migrationsFolder,
  });

  const database = sqlite({
    client,
    path: ":memory:",
    schema: {
      ...sqliteSchema,
      ...authSchema,
    },
  });

  const { ready } = createGoodchat({
    name: "Integration Bot",
    prompt: "Be helpful",
    platforms: ["local"],
    model: { provider: "openai", modelId: "gpt-4.1-mini" },
    database,
    auth: {
      enabled: true,
      mode: "password",
      password: authPassword,
      localChatPublic: false,
    },
    isServerless: true,
    dashboard: false,
  });
  const { app } = await ready;

  return {
    app,
    authPassword,
    sharedEmail: SHARED_AUTH_EMAIL,
    close: async () => {
      client.close();
      await rm(tempDirectory, {
        force: true,
        recursive: true,
      });
    },
  };
};
