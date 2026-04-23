import { nanoid } from "nanoid";
import type { EnvVariableMeta } from "../env-metadata";

const SECRET_LENGTH = 48;

const applyPlatformSpacing = (
  lines: string[],
  meta: EnvVariableMeta,
  lastPlatformGroup: string | undefined
): string | undefined => {
  const platformGroup = meta.platforms?.[0];
  if (!platformGroup) {
    return lastPlatformGroup;
  }
  if (lastPlatformGroup && platformGroup !== lastPlatformGroup) {
    lines.push("");
  }
  return platformGroup;
};

export const renderEnvSchemaFile = (metadata: EnvVariableMeta[]): string => {
  const entries = metadata
    .map((meta) => {
      const schema = meta.schema ?? "z.string().optional()";
      return `    ${meta.key}: ${schema},`;
    })
    .join("\n");

  return `import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
${entries}
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
`;
};

export const renderEnvFile = (
  metadata: EnvVariableMeta[],
  secretFactory: () => string = () => nanoid(SECRET_LENGTH)
): string => {
  const secretOverrides = new Map<string, string>();
  const authSecretMeta = metadata.find((m) => m.key === "GOODCHAT_AUTH_SECRET");
  if (authSecretMeta && !authSecretMeta.defaultValue) {
    secretOverrides.set("GOODCHAT_AUTH_SECRET", secretFactory());
  }
  const cronMeta = metadata.find((m) => m.key === "CRON_SECRET");
  if (cronMeta && !cronMeta.defaultValue) {
    secretOverrides.set("CRON_SECRET", secretFactory());
  }

  const lines: string[] = [];
  let lastCategory: string | undefined;
  let lastPlatformGroup: string | undefined;

  for (const meta of metadata) {
    const category = meta.category ?? "core";
    if (category !== lastCategory) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(`# ${category[0]?.toUpperCase()}${category.slice(1)}`);
      lastCategory = category;
      lastPlatformGroup = undefined;
    }
    if (category === "platform") {
      lastPlatformGroup = applyPlatformSpacing(lines, meta, lastPlatformGroup);
    }
    if (meta?.description) {
      lines.push(`# ${meta.description}`);
    }
    if (meta?.docsUrl) {
      lines.push(`# Docs: ${meta.docsUrl}`);
    }
    lines.push(
      `${meta.key}="${secretOverrides.get(meta.key) ?? meta.defaultValue ?? ""}"`
    );
  }

  return `${lines.join("\n")}\n`;
};
