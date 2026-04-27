import { describe, expect, it } from "vitest";
import { formatPublishedVersion, renderPackageJson } from "./package-json";

describe("package json renderer", () => {
  it("renders package scripts for sqlite lifecycle", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "sqlite",
        dependencyChannel: "latest",
        projectName: "goodchat-app",
        usesPlugins: false,
      })
    ) as {
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(packageJson.dependencies["@goodchat/cli"]).toBeDefined();
    expect(packageJson.scripts["db:schema:sync"]).toBe(
      "goodchat db schema sync"
    );
    expect(packageJson.scripts["db:schema:check"]).toBe(
      "goodchat db schema sync --check"
    );
    expect(packageJson.scripts["db:migrate"]).toBe("bun run src/db/migrate.ts");
    expect(packageJson.scripts.dev).toBe("bun run --hot src/index.ts");
    expect(packageJson.scripts["db:studio"]).toBe(
      "drizzle-kit studio --config=drizzle.config.ts"
    );
    expect(packageJson.scripts["db:up"]).toBeUndefined();
    expect(packageJson.scripts["db:down"]).toBeUndefined();
    expect(packageJson.scripts["docker:build"]).toBe(
      "docker build -t goodchat-bot ."
    );
    expect(packageJson.scripts["docker:migrate"]).toBe(
      "docker compose run --rm migrate"
    );
    expect(packageJson.scripts["docker:dev"]).toBe("docker compose up app");
    expect(packageJson.scripts["docker:rebuild"]).toBe(
      "docker compose up --build app"
    );
    expect(packageJson.scripts["docker:up"]).toBe("docker compose up -d app");
    expect(packageJson.scripts["docker:ready"]).toBe(
      "docker compose run --rm migrate && docker compose up -d --wait --wait-timeout 60 app"
    );
    expect(packageJson.scripts["docker:start"]).toBe(
      "docker compose up -d app"
    );
    expect(packageJson.scripts["docker:down"]).toBe(
      "docker compose down --remove-orphans"
    );
    expect(packageJson.scripts["docker:ps"]).toBe("docker compose ps --all");
    expect(packageJson.scripts["docker:check"]).toBe(
      "docker compose ps --format json app"
    );
    expect(packageJson.scripts.build).toBe("tsdown");
    expect(packageJson.scripts.start).toBe("bun run dist/index.mjs");
  });

  it("renders railway helper scripts for railway target", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "postgres",
        deploymentTarget: "railway",
        dependencyChannel: "latest",
        projectName: "goodchat-app",
        usesPlugins: false,
      })
    ) as {
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["railway:link"]).toBe("bunx @railway/cli link");
    expect(packageJson.scripts["railway:up"]).toBe("bunx @railway/cli up");
    expect(packageJson.scripts["railway:migrate"]).toBe(
      "bunx @railway/cli run bun run db:migrate"
    );
    expect(packageJson.scripts["docker:build"]).toBeUndefined();
    expect(packageJson.scripts.build).toBe("tsdown");
    expect(packageJson.scripts.start).toBe("bun run dist/index.mjs");
  });

  it("renders vercel helper scripts for vercel target", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "postgres",
        deploymentTarget: "vercel",
        dependencyChannel: "latest",
        projectName: "goodchat-app",
        usesPlugins: false,
      })
    ) as {
      devDependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["vercel:link"]).toBe("bunx vercel@latest link");
    expect(packageJson.scripts.dev).toBe("bun run --hot src/index.ts");
    expect(packageJson.scripts["vercel:dev"]).toBe("bunx vercel@latest dev");
    expect(packageJson.scripts["vercel:deploy:prod"]).toBe(
      "bunx vercel@latest --prod"
    );
    expect(packageJson.scripts["vercel:logs"]).toBe("bunx vercel@latest logs");
    expect(packageJson.scripts["docker:build"]).toBeUndefined();
    expect(packageJson.scripts.build).toBeUndefined();
    expect(packageJson.scripts.start).toBeUndefined();
    expect(packageJson.devDependencies["@types/node"]).toBeDefined();
  });

  it("renders drizzle migrate script for non-sqlite dialects", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "postgres",
        databaseProfileId: "postgres-local",
        dependencyChannel: "latest",
        projectName: "goodchat-app",
        usesPlugins: false,
      })
    ) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["db:migrate"]).toBe(
      "drizzle-kit migrate --config=drizzle.config.ts"
    );
    expect(packageJson.scripts["db:up"]).toBe("docker compose up -d");
    expect(packageJson.scripts["db:down"]).toBe("docker compose down");
  });

  it("does not render local docker db scripts for managed profiles", () => {
    const postgresPackageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "postgres",
        databaseProfileId: "postgres-neon",
        dependencyChannel: "latest",
        projectName: "goodchat-app",
        usesPlugins: false,
      })
    ) as {
      scripts: Record<string, string>;
    };

    const mysqlPackageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "mysql",
        databaseProfileId: "mysql-planetscale",
        dependencyChannel: "latest",
        projectName: "goodchat-app",
        usesPlugins: false,
      })
    ) as {
      scripts: Record<string, string>;
    };

    expect(postgresPackageJson.scripts["db:up"]).toBeUndefined();
    expect(postgresPackageJson.scripts["db:down"]).toBeUndefined();
    expect(mysqlPackageJson.scripts["db:up"]).toBeUndefined();
    expect(mysqlPackageJson.scripts["db:down"]).toBeUndefined();
  });

  it("renders package dependencies from next channel", () => {
    const packageJson = JSON.parse(
      renderPackageJson({
        databaseDialect: "sqlite",
        dependencyChannel: "next",
        projectName: "goodchat-app",
        usesPlugins: true,
      })
    ) as {
      dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies["@goodchat/cli"]).toBe("next");
    expect(packageJson.dependencies["@goodchat/core"]).toBe("next");
    expect(packageJson.dependencies["@goodchat/storage"]).toBe("next");
    expect(packageJson.dependencies["@goodchat/plugins"]).toBe("next");
  });
});

describe("formatPublishedVersion", () => {
  it("returns fallback for null", () => {
    expect(formatPublishedVersion(null, "^0.0.1")).toBe("^0.0.1");
  });

  it("preserves pre-prefixed ranges", () => {
    expect(formatPublishedVersion("^1.2.3", "^0.0.1")).toBe("^1.2.3");
    expect(formatPublishedVersion("~1.2.3", "^0.0.1")).toBe("~1.2.3");
  });

  it("adds caret to plain semver", () => {
    expect(formatPublishedVersion("1.2.3", "^0.0.1")).toBe("^1.2.3");
  });

  it("keeps dist tags and non-semver values", () => {
    expect(formatPublishedVersion("next", "^0.0.1")).toBe("next");
    expect(formatPublishedVersion("workspace:*", "^0.0.1")).toBe("workspace:*");
  });
});
