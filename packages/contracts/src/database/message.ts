export interface MessageResponseSourceMetadata {
  hook?: "beforeMessage";
  kind: "ai" | "hook";
  pluginKey?: string;
  pluginName?: string;
}

export interface MessageMetadata {
  responseSource?: MessageResponseSourceMetadata;
  [key: string]: unknown;
}

export interface Message {
  adapterName: string;
  createdAt: string;
  id: string;
  metadata?: MessageMetadata;
  role?: string;
  text: string;
  threadId: string;
  userId: string;
}

export type MessageCreate = Message;

export type MessageUpdate = Partial<
  Pick<Message, "metadata" | "role" | "text">
>;
