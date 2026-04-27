import { DEPLOYMENT_PROFILES } from "../deployment-profiles";
import type { DeploymentTarget } from "../deployment-targets";
import type { GeneratorConfig } from "../scaffold-types";
import {
  type DependencyChannel,
  GOODCHAT_DEPENDENCY_MANIFEST,
  resolveDefaultDependencyChannel,
} from "../version-manifest";

const SEMVER_VERSION_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

const DRIZZLE_ORM_VERSION = "^0.45.2";
const DRIZZLE_KIT_VERSION = "^0.31.10";
const TSDOWN_VERSION = "^0.16.5";
const TYPESCRIPT_VERSION = "^5.9.3";
const TYPES_BUN_VERSION = "^1.3.4";
const TYPES_NODE_VERSION = "^24.9.1";

export const formatPublishedVersion = (
  version: string | null,
  fallback: string
): string => {
  if (!version) {
    return fallback;
  }
  if (version.startsWith("^") || version.startsWith("~")) {
    return version;
  }
  if (!SEMVER_VERSION_REGEX.test(version)) {
    return version;
  }
  return `^${version}`;
};

export const renderPackageJson = (input: {
  databaseDialect: GeneratorConfig["databaseDialect"];
  databaseProfileId?: GeneratorConfig["databaseProfileId"];
  dependencyChannel?: DependencyChannel;
  deploymentTarget?: DeploymentTarget;
  projectName: string;
  usesPlugins: boolean;
}): string => {
  const channel = input.dependencyChannel ?? resolveDefaultDependencyChannel();
  const manifest = GOODCHAT_DEPENDENCY_MANIFEST[channel];

  const dependencies: Record<string, string> = {
    "@goodchat/cli": formatPublishedVersion(
      manifest["@goodchat/cli"],
      "^0.0.1"
    ),
    "@goodchat/core": formatPublishedVersion(
      manifest["@goodchat/core"],
      "^0.0.1"
    ),
    "@goodchat/storage": formatPublishedVersion(
      manifest["@goodchat/storage"],
      "^0.0.1"
    ),
    "@t3-oss/env-core": "^0.13.1",
    dotenv: "^17.2.2",
    "drizzle-orm": DRIZZLE_ORM_VERSION,
    elysia: "^1.4.28",
    zod: "^4.1.13",
  };

  if (input.usesPlugins) {
    dependencies["@goodchat/plugins"] = formatPublishedVersion(
      manifest["@goodchat/plugins"],
      "^0.0.1"
    );
  }

  const devDependencies: Record<string, string> = {
    "@types/bun": TYPES_BUN_VERSION,
    "drizzle-kit": DRIZZLE_KIT_VERSION,
    tsdown: TSDOWN_VERSION,
    typescript: TYPESCRIPT_VERSION,
  };

  if (input.deploymentTarget === "vercel") {
    devDependencies["@types/node"] = TYPES_NODE_VERSION;
  }

  const migrateCommand =
    input.databaseDialect === "sqlite"
      ? "bun run src/db/migrate.ts"
      : "drizzle-kit migrate --config=drizzle.config.ts";
  const hasLocalDockerProfile =
    input.databaseProfileId === "postgres-local" ||
    input.databaseProfileId === "mysql-local";

  const baseScripts: Record<string, string> = {
    dev: "bun run --hot src/index.ts",
    "check-types": "tsc -b",
    "db:schema:sync": "goodchat db schema sync",
    "db:schema:check": "goodchat db schema sync --check",
    "db:generate": "drizzle-kit generate --config=drizzle.config.ts",
    "db:migrate": migrateCommand,
    "db:push": "drizzle-kit push --config=drizzle.config.ts",
    "db:studio": "drizzle-kit studio --config=drizzle.config.ts",
    ...(hasLocalDockerProfile
      ? {
          "db:up": "docker compose up -d",
          "db:down": "docker compose down",
        }
      : {}),
  };

  const profile = DEPLOYMENT_PROFILES[input.deploymentTarget ?? "docker"];

  return `${JSON.stringify(
    {
      name: input.projectName,
      type: "module",
      main: "src/index.ts",
      scripts: { ...baseScripts, ...profile.scripts(input.databaseDialect) },
      dependencies,
      devDependencies,
    },
    null,
    2
  )}\n`;
};
