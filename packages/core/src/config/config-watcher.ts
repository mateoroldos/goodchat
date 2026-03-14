import { type FSWatcher, watch } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Result } from "better-result";
import type { FileConfigService } from "./config.service";
import { resolveConfigDirectories } from "./config.service";
import { ConfigWatcherError } from "./errors";
import type { BotConfig } from "./models";

interface ConfigWatcherOptions {
  configPath?: string;
  configService: FileConfigService;
  debounceMs?: number;
  onError?: (error: ConfigWatcherError) => void;
  onReload: (configs: BotConfig[]) => Promise<void> | void;
}

export const watchBotConfigs = async ({
  configService,
  configPath = "bots",
  debounceMs = 50,
  onReload,
  onError,
}: ConfigWatcherOptions) => {
  const searchPaths = resolveConfigDirectories(configPath);
  let baseDir: string | null = null;

  for (const path of searchPaths) {
    try {
      await access(path);
      baseDir = path;
      break;
    } catch {
      // ignore missing paths
    }
  }

  if (!baseDir) {
    const error = new ConfigWatcherError("Bots directory not found", {
      configPath,
      attemptedPaths: searchPaths,
    });
    onError?.(error);
    return Result.err(error);
  }

  const watchers = new Map<string, FSWatcher>();
  let debounceTimer: NodeJS.Timeout | null = null;
  let reloadPromise: Promise<void> | null = null;

  const reloadConfigs = async () => {
    const result = await configService.loadBotConfigs(configPath);
    if (result.isErr()) {
      const error = new ConfigWatcherError(
        result.error.message,
        { configPath, attemptedPaths: searchPaths },
        result.error
      );
      onError?.(error);
      return;
    }
    await onReload(result.value);
  };

  const queueReload = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!reloadPromise) {
        reloadPromise = reloadConfigs().finally(() => {
          reloadPromise = null;
        });
      }
    }, debounceMs);
  };

  const updateWatchers = async () => {
    const entries = await readdir(baseDir, { withFileTypes: true });
    const botDirs = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(baseDir, entry.name));

    const nextSet = new Set(botDirs);
    for (const [dir, watcher] of watchers) {
      if (!nextSet.has(dir)) {
        watcher.close();
        watchers.delete(dir);
      }
    }

    for (const dir of botDirs) {
      if (watchers.has(dir)) {
        continue;
      }

      const watcher = watch(dir, () => {
        queueReload();
      });

      watchers.set(dir, watcher);
    }
  };

  const baseWatcher = watch(baseDir, () => {
    updateWatchers().catch((error) => {
      const watcherError = new ConfigWatcherError(
        "Failed to update bot watchers",
        { configPath, attemptedPaths: searchPaths },
        error
      );
      onError?.(watcherError);
    });
    queueReload();
  });

  await updateWatchers();

  const stop = () => {
    baseWatcher.close();
    for (const watcher of watchers.values()) {
      watcher.close();
    }
  };

  return Result.ok({ stop });
};
