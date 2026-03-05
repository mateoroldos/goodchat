import type { Handle } from "@sveltejs/kit";
import { env } from "$env/dynamic/public";
import { createEdenClient } from "$lib/eden-client";

export const handle: Handle = ({ event, resolve }) => {
  event.locals.eden = createEdenClient(env.PUBLIC_SERVER_URL, {
    fetcher: event.fetch,
    credentials: "include",
  });

  return resolve(event);
};
