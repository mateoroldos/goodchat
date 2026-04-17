import type { Logger } from "@goodchat/contracts/plugins/types";

export interface LoggerService {
  event: {
    error: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
  request(): Logger;
  wide(context?: Record<string, unknown>): Logger;
}
