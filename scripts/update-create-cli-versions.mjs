/**
 * Reads the current version of each goodchat workspace package and regenerates
 * apps/create-cli/src/version-manifest.ts with up-to-date versions.
 *
 * Called automatically by `bun run ci:version` after `changeset version`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readVersion = (packagePath) => {
  const pkg = JSON.parse(
    readFileSync(resolve(root, packagePath, "package.json"), "utf8")
  );
  if (typeof pkg.version !== "string" || pkg.version.trim().length === 0) {
    throw new Error(`Missing version in ${packagePath}/package.json`);
  }
  return pkg.version;
};

const PACKAGES = {
  "@goodchat/storage": "packages/storage",
  "@goodchat/cli": "apps/goodchat-cli",
  "@goodchat/core": "packages/core",
  "@goodchat/plugins": "packages/plugins",
};

const versions = Object.fromEntries(
  Object.entries(PACKAGES).map(([name, path]) => [name, readVersion(path)])
);

const latestEntries = Object.entries(versions)
  .map(([k, v]) => `    "${k}": "${v}",`)
  .join("\n");

const nextEntries = Object.keys(versions)
  .map((k) => `    "${k}": "next",`)
  .join("\n");

const content = `import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEPENDENCY_CHANNELS = ["latest", "next"] as const;

export type DependencyChannel = (typeof DEPENDENCY_CHANNELS)[number];

// Versions are auto-updated by scripts/update-create-cli-versions.mjs during \`bun run ci:version\`
export const GOODCHAT_DEPENDENCY_MANIFEST = {
  latest: {
${latestEntries}
  },
  next: {
${nextEntries}
  },
} as const satisfies Record<DependencyChannel, Record<string, string>>;

export const resolveDefaultDependencyChannel = (): DependencyChannel => {
  try {
    const filePath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../package.json"
    );
    const content = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content) as { version?: unknown };
    if (typeof parsed.version === "string" && parsed.version.includes("-")) {
      return "next";
    }
  } catch {
    // ignore
  }
  return "latest";
};
`;

const outPath = resolve(root, "apps/create-cli/src/version-manifest.ts");
writeFileSync(outPath, content, "utf8");

console.log("Updated apps/create-cli/src/version-manifest.ts:");
for (const [name, version] of Object.entries(versions)) {
  console.log(`  ${name}@${version}`);
}
