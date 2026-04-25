import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DEPENDENCY_CHANNELS = ["latest", "next"] as const;

export type DependencyChannel = (typeof DEPENDENCY_CHANNELS)[number];

// Versions are auto-updated by scripts/update-create-cli-versions.mjs during `bun run ci:version`
export const GOODCHAT_DEPENDENCY_MANIFEST = {
  latest: {
    "@goodchat/storage": "0.0.19",
    "@goodchat/cli": "0.0.13",
    "@goodchat/core": "0.0.19",
    "@goodchat/plugins": "0.0.17",
  },
  next: {
    "@goodchat/storage": "next",
    "@goodchat/cli": "next",
    "@goodchat/core": "next",
    "@goodchat/plugins": "next",
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
