import { error } from "@sveltejs/kit";
import { getRequestEvent, query } from "$app/server";

export const getLogs = query(async () => {
  const { locals } = getRequestEvent();

  const { data, error: edenError } = await locals.eden.logs.get();

  if (edenError) {
    const { status, value } = edenError;

    error(status, value.message);
  }

  if (!Array.isArray(data)) {
    error(500, "Failed to load logs");
  }

  return data;
});
