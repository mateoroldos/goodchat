import { treaty } from "@elysiajs/eden";
import type { App } from "../../../server/src/app";

const getBaseUrl = () =>
  typeof window === "undefined" ? "" : `${window.location.origin}`;

export const eden = treaty<App>(getBaseUrl(), {
  fetcher: fetch,
});
