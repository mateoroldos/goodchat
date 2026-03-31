export interface Message {
  adapterName: string;
  createdAt: string;
  id: string;
  metadata?: Record<string, unknown>;
  role?: string;
  text: string;
  threadId: string;
  userId: string;
}

export type MessageCreate = Message;

export type MessageUpdate = Partial<
  Pick<Message, "metadata" | "role" | "text">
>;
