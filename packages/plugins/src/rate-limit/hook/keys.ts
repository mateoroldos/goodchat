import type { BeforeContext } from "./types";

type Scope = "bot" | "thread" | "user";

export const resolveKey = (scope: Scope, input: BeforeContext): string => {
  if (scope === "thread") {
    return input.threadId;
  }

  if (scope === "user") {
    return input.userId;
  }

  return "global";
};
