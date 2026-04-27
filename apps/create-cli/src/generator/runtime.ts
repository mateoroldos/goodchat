import { resolveModelFactoryName } from "@goodchat/contracts/model/provider-metadata";
import type { GeneratorConfig } from "../scaffold-types";

export const buildDatabaseExpression = (config: GeneratorConfig): string => {
  if (config.databaseDialect === "sqlite") {
    return "sqlite({ path: env.DATABASE_URL, schema })";
  }
  if (config.databaseDialect === "postgres") {
    return config.databaseProfileId === "postgres-neon"
      ? 'postgres({ connectionString: env.DATABASE_URL, driver: "@neondatabase/serverless", schema })'
      : "postgres({ connectionString: env.DATABASE_URL, schema })";
  }
  return config.databaseProfileId === "mysql-planetscale"
    ? 'mysql({ connectionString: env.DATABASE_URL, mode: "planetscale", schema })'
    : "mysql({ connectionString: env.DATABASE_URL, schema })";
};

export const buildImports = (
  config: GeneratorConfig,
  nodeEsm?: boolean
): string[] => {
  const coreImports = ["createGoodchat"];
  if (config.model) {
    coreImports.push(resolveModelFactoryName(config.model.provider));
  }

  const imports = [
    `import { ${coreImports.join(", ")} } from "@goodchat/core";`,
    `import { schema } from "./db/schema${nodeEsm ? ".js" : ""}";`,
    `import { env } from "./env${nodeEsm ? ".js" : ""}";`,
  ];
  if (config.databaseDialect === "sqlite") {
    imports.push('import { sqlite } from "@goodchat/storage/sqlite";');
  }
  if (config.databaseDialect === "postgres") {
    imports.push('import { postgres } from "@goodchat/storage/postgres";');
  }
  if (config.databaseDialect === "mysql") {
    imports.push('import { mysql } from "@goodchat/storage/mysql";');
  }
  if (config.plugins?.includes("linear")) {
    imports.push('import { linear } from "@goodchat/plugins/linear";');
  }
  return imports;
};

export const renderGoodchatFile = (
  config: GeneratorConfig,
  isServerless?: boolean,
  nodeEsm?: boolean
): string => {
  const plugins = config.plugins ?? [];
  const imports = buildImports(config, nodeEsm);
  const db = buildDatabaseExpression(config);

  const entries: string[] = [
    `  name: ${JSON.stringify(config.name)},`,
    `  prompt: ${JSON.stringify(config.prompt)},`,
    `  platforms: ${JSON.stringify(config.platforms)},`,
  ];

  if (config.id) {
    entries.push(`  id: ${JSON.stringify(config.id)},`);
  }
  if (isServerless) {
    entries.push("  isServerless: true,");
  }
  if (plugins.length > 0) {
    entries.push(`  plugins: [${plugins.join(", ")}],`);
  }
  if (config.model) {
    const factory = resolveModelFactoryName(config.model.provider);
    entries.push(
      `  model: ${factory}(${JSON.stringify(config.model.modelId)}),`
    );
  }
  if (config.mcp && config.mcp.length > 0) {
    const mcpValue = JSON.stringify(config.mcp, null, 2)
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n");
    entries.push(`  mcp: ${mcpValue.trimStart()},`);
  }

  const authEnabled = config.authEnabled
    ? 'env.ENVIRONMENT !== "development"'
    : "false";
  entries.push("  auth: {");
  entries.push(`    enabled: ${authEnabled},`);
  if (config.authEnabled) {
    entries.push("    password: env.GOODCHAT_DASHBOARD_PASSWORD,");
  }
  entries.push("  },");
  entries.push(`  database: ${db},`);

  return `${imports.join("\n")}

export const goodchat = createGoodchat({
${entries.join("\n")}
});
`;
};
