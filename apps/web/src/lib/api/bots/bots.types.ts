import type { eden } from "$lib/eden-client";
import type { EdenSuccess } from "$lib/utils";

type BotsListData = EdenSuccess<typeof eden.api.bots.get>;
type BotDetailData = EdenSuccess<ReturnType<typeof eden.api.bots>["get"]>;
type BotThreadsData = EdenSuccess<
  ReturnType<typeof eden.api.bots>["threads"]["get"]
>;

export type BotList = BotsListData;
export type Bot = BotDetailData extends infer Item
  ? Item extends { id: string }
    ? Item
    : BotList extends Array<infer ListItem>
      ? ListItem
      : never
  : never;
export type BotThreadList = BotThreadsData;
export type BotThread = BotThreadList extends Array<infer Item> ? Item : never;
export type BotId = Bot extends { id: infer Id } ? Id : never;
export type BotPlatform = Bot extends { platforms: Array<infer Platform> }
  ? Platform
  : never;
