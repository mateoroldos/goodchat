import { existsSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, "..");
const sourceDir = join(rootDir, "apps/web/build");
const destinationDir = join(rootDir, "packages/core/dist/web");

if (!existsSync(sourceDir)) {
  process.stdout.write(
    "web build output not found at apps/web/build. Skipping copy.\n"
  );
  process.exit(0);
}

await rm(destinationDir, { recursive: true, force: true });
await cp(sourceDir, destinationDir, { recursive: true });
process.stdout.write("Copied web build into packages/core/dist/web.\n");
