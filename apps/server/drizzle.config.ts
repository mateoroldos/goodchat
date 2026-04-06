import "dotenv/config";
import { isAbsolute, join, resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

const DEFAULT_SQLITE_FILE_NAME = "goodchat.sqlite";
const DEFAULT_LOCAL_DATABASE_DIRECTORY = ".data";

const toAbsolutePath = (path: string): string => {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
};

const resolveDatabasePath = (): string => {
  const configuredPath = process.env.DATABASE_URL;
  if (configuredPath) {
    return toAbsolutePath(configuredPath);
  }

  const railwayVolumeMountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH;
  if (railwayVolumeMountPath) {
    return join(railwayVolumeMountPath, DEFAULT_SQLITE_FILE_NAME);
  }

  return resolve(
    process.cwd(),
    DEFAULT_LOCAL_DATABASE_DIRECTORY,
    DEFAULT_SQLITE_FILE_NAME
  );
};

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${resolveDatabasePath()}`,
  },
});
