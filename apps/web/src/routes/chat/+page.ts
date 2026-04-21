import { error } from "@sveltejs/kit";
import { botQueries } from "$lib/api/bots/bots.queries";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ parent }) => {
  const { queryClient } = await parent();
  const bot = await queryClient.ensureQueryData(botQueries.detail());

  if (!bot.platforms.includes("web")) {
    error(404, "Not found");
  }
};
