import type { Logger } from "@goodchat/contracts/plugins/types";

export const NOOP_LOGGER: Logger = {
  emit: () => null,
  error: () => undefined,
  getContext: () => ({}),
  info: () => undefined,
  set: () => undefined,
  warn: () => undefined,
};
