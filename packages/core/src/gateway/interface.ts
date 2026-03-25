import type { Platform } from "@goodchat/contracts/config/types";
import type {
  Adapter,
  Chat,
  MentionHandler,
  SubscribedMessageHandler,
} from "chat";

export interface ChatGatewayConfig {
  platforms: readonly Platform[];
  userName: string;
}

export interface ChatGatewayHandlers {
  onNewMention?: MentionHandler;
  onSubscribedMessage?: SubscribedMessageHandler;
}

export interface ChatGatewayService {
  getAdapter(name: Platform): Adapter | null;
  getPlatformIds(): readonly Platform[];
  getWebhooks(): Chat["webhooks"];
  initialize(): Promise<void>;
  registerHandlers(handlers: ChatGatewayHandlers): void;
  shutdown(): Promise<void>;
}
