import { outro } from "@clack/prompts";
import { runDbSchemaSync } from "./commands/db-schema-sync-command";

const HELP_TEXT = `goodchat CLI

Usage:
  goodchat db schema sync [--check] [--json] [--config <path>] [--dialect <dialect>]
`;

const isDbSchemaSyncCommand = (args: string[]): boolean => {
  return args[0] === "db" && args[1] === "schema" && args[2] === "sync";
};

const parseInlineFlag = (flag: string, prefix: string): string | undefined => {
  if (!flag.startsWith(prefix)) {
    return undefined;
  }

  const value = flag.slice(prefix.length);
  if (!value) {
    throw new Error(`Missing value for ${prefix.slice(0, -1)}\n\n${HELP_TEXT}`);
  }
  return value;
};

const parseNextFlagValue = (
  flags: string[],
  index: number,
  optionName: string
): string => {
  const value = flags[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${optionName}\n\n${HELP_TEXT}`);
  }
  return value;
};

const parseDbSchemaSyncFlags = (
  flags: string[]
): { check: boolean; json: boolean; configPath?: string; dialect?: string } => {
  let check = false;
  let json = false;
  let configPath: string | undefined;
  let dialect: string | undefined;

  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index] as string;

    if (flag === "--check") {
      check = true;
      continue;
    }

    if (flag === "--json") {
      json = true;
      continue;
    }

    if (flag === "--config") {
      configPath = parseNextFlagValue(flags, index, "--config");
      index += 1;
      continue;
    }

    const inlineConfig = parseInlineFlag(flag, "--config=");
    if (inlineConfig) {
      configPath = inlineConfig;
      continue;
    }

    if (flag === "--dialect") {
      dialect = parseNextFlagValue(flags, index, "--dialect");
      index += 1;
      continue;
    }

    const inlineDialect = parseInlineFlag(flag, "--dialect=");
    if (inlineDialect) {
      dialect = inlineDialect;
      continue;
    }

    throw new Error(`Unsupported flag: ${flag}\n\n${HELP_TEXT}`);
  }

  return { check, json, configPath, dialect };
};

const run = async (): Promise<void> => {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    outro(HELP_TEXT);
    return;
  }

  if (!isDbSchemaSyncCommand(args)) {
    throw new Error(`Unknown command: ${args.join(" ")}\n\n${HELP_TEXT}`);
  }

  const flags = args.slice(3);
  const parsedFlags = parseDbSchemaSyncFlags(flags);

  await runDbSchemaSync({
    cwd: process.cwd(),
    check: parsedFlags.check,
    json: parsedFlags.json,
    configPath: parsedFlags.configPath,
    dialect: parsedFlags.dialect,
  });

  outro(parsedFlags.check ? "Schema is in sync." : "Schema sync completed.");
};

await run();
