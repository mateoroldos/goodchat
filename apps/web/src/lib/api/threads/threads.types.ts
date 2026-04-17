import type { eden } from "$lib/eden-client";
import type { EdenSuccess } from "$lib/utils";

type ThreadsEndpoint = ReturnType<typeof eden.api.threads>;
type ThreadsListData = EdenSuccess<typeof eden.api.threads.get>;
type MessagesData = EdenSuccess<ThreadsEndpoint["messages"]["get"]>;
type RunsData = EdenSuccess<ThreadsEndpoint["runs"]["get"]>;

export type ThreadList = ThreadsListData;
export type Thread = ThreadList extends Array<infer Item> ? Item : never;
export type ThreadId = Thread extends { id: infer Id } ? Id : never;

export type MessageList = MessagesData;
export type Message = MessageList extends Array<infer Item> ? Item : never;

export type RunList = RunsData;
export type Run = RunList extends Array<infer Item> ? Item : never;
export type ToolCall = Run extends { toolCalls: Array<infer Item> }
  ? Item
  : never;
