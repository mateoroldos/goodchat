import { renderDbSchemaArtifacts } from "@goodchat/templates/scaffold/db-schema-artifacts";
import { DEPLOYMENT_PROFILES } from "./deployment-profiles";
import type { DeploymentTarget } from "./deployment-targets";
import {
  type EnvVariableMeta,
  getEnvMetadata,
  type Provider,
} from "./env-metadata";
import {
  renderEnvFile as renderEnvFileInternal,
  renderEnvSchemaFile as renderEnvSchemaFileInternal,
} from "./generator/env";
import { renderIndexFile as renderIndexFileInternal } from "./generator/index-file";
import { renderPackageJson as renderPackageJsonInternal } from "./generator/package-json";
import { renderGoodchatFile as renderGoodchatFileInternal } from "./generator/runtime";
import { renderServeFile as renderServeFileInternal } from "./generator/serve-file";
import { renderSqliteMigrateFile as renderSqliteMigrateFileInternal } from "./generator/sqlite-migrate";
import type { GeneratorConfig, ProjectFile } from "./scaffold-types";

export type {
  GeneratorConfig,
  ProjectFile,
  ScaffolderConfig,
  SelectedModel,
} from "./scaffold-types";

import type { DependencyChannel } from "./version-manifest";

export interface ProjectTemplateInput {
  config: GeneratorConfig;
  dependencyChannel?: DependencyChannel;
  deploymentTarget?: DeploymentTarget;
  envMetadata: EnvVariableMeta[];
  projectName: string;
}

export const getEnvMetadataForConfig = (input: {
  authEnabled?: boolean;
  platforms: GeneratorConfig["platforms"];
  plugins?: string[];
  provider?: Provider | null;
}): EnvVariableMeta[] => {
  return getEnvMetadata({
    authEnabled: input.authEnabled,
    platforms: input.platforms,
    plugins: input.plugins,
    provider: input.provider,
  });
};

export const renderEnvFile = (
  ...args: Parameters<typeof renderEnvFileInternal>
) => renderEnvFileInternal(...args);
export const renderEnvSchemaFile = (
  ...args: Parameters<typeof renderEnvSchemaFileInternal>
) => renderEnvSchemaFileInternal(...args);
export const renderIndexFile = (
  ...args: Parameters<typeof renderIndexFileInternal>
) => renderIndexFileInternal(...args);
export const renderPackageJson = (
  ...args: Parameters<typeof renderPackageJsonInternal>
) => renderPackageJsonInternal(...args);
export const renderGoodchatFile = (
  ...args: Parameters<typeof renderGoodchatFileInternal>
) => renderGoodchatFileInternal(...args);
export const renderSqliteMigrateFile = (
  ...args: Parameters<typeof renderSqliteMigrateFileInternal>
) => renderSqliteMigrateFileInternal(...args);

const renderNodeEsmTsconfig = (): string => `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ESNext"],
    "verbatimModuleSyntax": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
`;

export const renderTsconfig = (deploymentTarget?: DeploymentTarget): string =>
  deploymentTarget === "vercel"
    ? renderNodeEsmTsconfig()
    : `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "verbatimModuleSyntax": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noEmit": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["bun"]
  },
  "include": ["src/**/*.ts"]
}
`;

export const renderGitignore = (): string => `node_modules
dist
.env
`;

export const createProjectFiles = async (
  input: ProjectTemplateInput
): Promise<ProjectFile[]> => {
  const target = input.deploymentTarget ?? "docker";
  const profile = DEPLOYMENT_PROFILES[target];
  const usesPlugins = (input.config.plugins ?? []).length > 0;
  const nodeEsm = target === "vercel";
  const schemaFiles = await renderDbSchemaArtifacts({
    authEnabled: input.config.authEnabled,
    dialect: input.config.databaseDialect,
  });
  const sqliteMigrateFile =
    input.config.databaseDialect === "sqlite"
      ? [
          {
            path: "src/db/migrate.ts",
            content: renderSqliteMigrateFileInternal(),
          },
        ]
      : [];

  const serveFile = [
    { path: "src/serve.ts", content: renderServeFileInternal() },
  ];

  return [
    {
      path: "package.json",
      content: renderPackageJsonInternal({
        databaseDialect: input.config.databaseDialect,
        databaseProfileId: input.config.databaseProfileId,
        dependencyChannel: input.dependencyChannel,
        deploymentTarget: target,
        projectName: input.projectName,
        usesPlugins,
      }),
    },
    { path: "tsconfig.json", content: renderTsconfig(target) },
    {
      path: "src/goodchat.ts",
      content: renderGoodchatFileInternal(
        input.config,
        profile.isServerless,
        nodeEsm
      ),
    },
    {
      path: "src/index.ts",
      content: renderIndexFileInternal(profile.isServerless, target),
    },
    {
      path: "src/env.ts",
      content: renderEnvSchemaFileInternal(input.envMetadata),
    },
    { path: ".env", content: renderEnvFileInternal(input.envMetadata) },
    { path: ".gitignore", content: renderGitignore() },
    { path: "README.md", content: profile.readme(input.config) },
    ...profile.configFiles(input.config),
    ...serveFile,
    ...sqliteMigrateFile,
    ...Object.entries(schemaFiles).map(([path, content]) => ({
      path,
      content,
    })),
  ];
};
