import type { eden } from "$lib/eden-client";
import type { EdenSuccess } from "$lib/utils";

type PlatformStatusEndpoint = ReturnType<
  ReturnType<typeof eden.api.bot.platforms>["status"]["get"]
>;

export type PlatformStatus = EdenSuccess<() => PlatformStatusEndpoint>;
