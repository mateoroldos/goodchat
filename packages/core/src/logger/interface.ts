import type { Logger } from "@goodchat/contracts/plugins/types";

export interface LoggerService {
  get(): Logger;
}
