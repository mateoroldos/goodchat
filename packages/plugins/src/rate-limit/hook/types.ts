import type { GoodchatHooks } from "@goodchat/contracts/plugins/types";

export type BeforeContext = Parameters<
  NonNullable<GoodchatHooks["beforeMessage"]>
>[0];

export interface BuildHookInput {
  config: import("../config").ParsedRateLimitConfig;
}
