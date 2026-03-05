import { treaty } from "@elysiajs/eden";
import type { App } from "../../../server/src/app";

interface EdenClientOptions {
  credentials?: RequestCredentials;
  fetcher?: typeof fetch;
}

export const createEdenClient = (
  baseUrl: string,
  options: EdenClientOptions = {}
) =>
  treaty<App>(baseUrl, {
    fetcher: options.fetcher,
    fetch: options.credentials
      ? { credentials: options.credentials }
      : undefined,
  });
