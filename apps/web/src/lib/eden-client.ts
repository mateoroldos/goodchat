import { treaty } from "@elysiajs/eden";
import type { GoodbotApi } from "@goodbot/core";

const getBaseUrl = () =>
  typeof window === "undefined" ? "" : `${window.location.origin}`;

export const eden = treaty<GoodbotApi>(getBaseUrl(), {
  fetcher: fetch,
});
