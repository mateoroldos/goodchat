import { treaty } from "@elysiajs/eden";
import type { GoodchatApi } from "@goodchat/core";

const getBaseUrl = () =>
  typeof window === "undefined" ? "" : `${window.location.origin}`;

export const eden = treaty<GoodchatApi>(getBaseUrl(), {
  fetcher: fetch,
  parseDate: false,
});
