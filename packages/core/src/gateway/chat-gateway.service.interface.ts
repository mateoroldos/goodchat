import type {
  Adapter,
  Chat,
  MentionHandler,
  SubscribedMessageHandler,
} from "chat";
import type { Platform } from "../config/models";

export interface ChatGatewayConfig {
  botId: string;
  platforms: readonly Platform[];
  userName: string;
}

export interface ChatGatewayHandlers {
  onNewMention?: MentionHandler;
  onSubscribedMessage?: SubscribedMessageHandler;
}

export interface ChatGatewayService {
  getAdapter(name: string): Adapter | null;
  getPlatformIds(): readonly Platform[];
  getWebhooks(): Chat["webhooks"];
  initialize(): Promise<void>;
  registerHandlers(handlers: ChatGatewayHandlers): void;
  shutdown(): Promise<void>;
}
