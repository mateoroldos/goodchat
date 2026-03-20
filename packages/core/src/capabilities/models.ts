import type { Tool } from "ai";
import z from "zod";
import type { GoodbotHooks } from "../plugins/models";

const afterMessageSchema = z.custom<GoodbotHooks["afterMessage"]>(
  (value) => typeof value === "function",
  {
    message: "Expected a function",
  }
);

const beforeMessageSchema = z.custom<GoodbotHooks["beforeMessage"]>(
  (value) => typeof value === "function",
  {
    message: "Expected a function",
  }
);

export const goodbotHooksSchema = z.object({
  afterMessage: afterMessageSchema.optional(),
  beforeMessage: beforeMessageSchema.optional(),
});

export const toolSchema = z.custom<Tool>(
  (value) => value !== null && typeof value === "object",
  {
    message: "Tool must be an object",
  }
);
