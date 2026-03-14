import type { eden } from "$lib/eden-client";
import type { EdenSuccess } from "$lib/utils";

type ThreadsListData = EdenSuccess<typeof eden.api.threads.get>;

export type ThreadList = ThreadsListData;
export type Thread = ThreadList extends Array<infer Item> ? Item : never;
export type ThreadId = Thread extends { id: infer Id } ? Id : never;
