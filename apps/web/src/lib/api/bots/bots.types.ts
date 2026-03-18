import type { eden } from "$lib/eden-client";
import type { EdenSuccess } from "$lib/utils";

type BotDetailData = EdenSuccess<typeof eden.api.bot.get>;
type BotThreadsData = EdenSuccess<typeof eden.api.bot.threads.get>;

export type Bot = BotDetailData extends infer Item
  ? Item extends { id: string }
    ? Item
    : never
  : never;
export type BotThreadList = BotThreadsData;
export type BotThread = BotThreadList extends Array<infer Item> ? Item : never;
export type BotId = Bot extends { id: infer Id } ? Id : never;
export type BotPlatform = Bot extends { platforms: Array<infer Platform> }
  ? Platform
  : never;
