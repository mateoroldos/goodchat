import type { RequestLogger } from "evlog";

export type Logger = RequestLogger<Record<string, unknown>>;
