import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

const DEFAULT_SQLITE_FILE_NAME = "goodchat.sqlite";
const DEFAULT_LOCAL_DATABASE_DIRECTORY = ".data";

const toAbsolutePath = (path: string): string => {
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
};

const resolveDatabasePath = (): string => {
  const configuredPath = process.env.GOODCHAT_DB_PATH;
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

const ensureFileParentDirectory = async (filePath: string): Promise<void> => {
  if (filePath === ":memory:") {
    return;
  }

  await mkdir(dirname(filePath), { recursive: true });
};

const isServerless =
  process.env.SERVERLESS === "true" || process.env.VERCEL === "1";
const port = Number(process.env.PORT ?? 3000);
const databasePath = resolveDatabasePath();

await ensureFileParentDirectory(databasePath);

export const config = {
  databasePath,
  isServerless,
  port,
};
