import { spawnSync } from "node:child_process";

const DEFAULT_POSTGRES_URL =
  "postgres://goodchat:goodchat@localhost:5432/postgres";
const DEFAULT_MYSQL_URL = "mysql://root:goodchat@localhost:3306/mysql";
const HEALTH_TIMEOUT_MS = 60_000;
const HEALTH_POLL_MS = 1000;
const SERVICE_NAMES = ["postgres", "mysql"];
const TEST_COMPOSE_FILE = "docker-compose.test.yml";

if (!process.env.POSTGRES_TEST_URL) {
  process.env.POSTGRES_TEST_URL = DEFAULT_POSTGRES_URL;
}

if (!process.env.MYSQL_TEST_URL) {
  process.env.MYSQL_TEST_URL = DEFAULT_MYSQL_URL;
}

const runProcess = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    env: process.env,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getContainerIds = () => {
  const result = runProcess(
    "docker",
    ["compose", "-f", TEST_COMPOSE_FILE, "ps", "-q", ...SERVICE_NAMES],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  const output = result.stdout.trim();
  if (!output) {
    return [];
  }
  return output
    .split("\n")
    .map((id) => id.trim())
    .filter(Boolean);
};

const getContainerStates = (containerIds) => {
  const result = runProcess("docker", ["inspect", ...containerIds], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const entries = JSON.parse(result.stdout);
  return entries.map((entry) => ({
    id: entry.Id,
    name: entry.Name,
    status: entry?.State?.Status ?? "unknown",
    health: entry?.State?.Health?.Status ?? "unknown",
  }));
};

const waitForServicesHealthy = async () => {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ids = getContainerIds();
    if (ids.length === 0) {
      await sleep(HEALTH_POLL_MS);
      continue;
    }
    const states = getContainerStates(ids);
    const unhealthy = states.filter((state) => state.health !== "healthy");
    if (unhealthy.length === 0) {
      return;
    }
    await sleep(HEALTH_POLL_MS);
  }
  throw new Error(
    `Timed out waiting for healthy services: ${SERVICE_NAMES.join(", ")}`
  );
};

let exitCode = 0;

try {
  runProcess("bun", ["run", "test:db:up"], { stdio: "inherit" });
  await waitForServicesHealthy();
  runProcess("bun", ["run", "test:migrations"], { stdio: "inherit" });
  runProcess("bun", ["run", "test:integration:sqlite"], {
    stdio: "inherit",
  });
  runProcess("bun", ["test", "packages/core/tests/integration"], {
    stdio: "inherit",
  });
  runProcess(
    "bun",
    ["x", "vitest", "run", "--config", "vitest.integration.config.ts"],
    { stdio: "inherit" }
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  try {
    runProcess("bun", ["run", "test:db:down"], { stdio: "inherit" });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    exitCode = exitCode === 0 ? 1 : exitCode;
  }
}

process.exit(exitCode);
