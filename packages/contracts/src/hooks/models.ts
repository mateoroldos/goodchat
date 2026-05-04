import z from "zod";
import type { GoodchatHooks, GoodchatPluginHooks } from "./types";

const afterMessageSchema = z.custom<NonNullable<GoodchatHooks["afterMessage"]>>(
  (value) => typeof value === "function",
  {
    message: "Expected a function",
  }
);

const beforeMessageSchema = z.custom<
  NonNullable<GoodchatHooks["beforeMessage"]>
>((value) => typeof value === "function", {
  message: "Expected a function",
});

export const goodchatHooksSchema = z.object({
  afterMessage: afterMessageSchema.optional(),
  beforeMessage: beforeMessageSchema.optional(),
});

const pluginAfterMessageSchema = z.custom<
  NonNullable<GoodchatPluginHooks["afterMessage"]>
>((value) => typeof value === "function", {
  message: "Expected a function",
});

const pluginBeforeMessageSchema = z.custom<
  NonNullable<GoodchatPluginHooks["beforeMessage"]>
>((value) => typeof value === "function", {
  message: "Expected a function",
});

export const goodchatPluginHooksSchema = z.object({
  afterMessage: pluginAfterMessageSchema.optional(),
  beforeMessage: pluginBeforeMessageSchema.optional(),
});

export type GoodchatHooksSchemaInput = z.infer<typeof goodchatHooksSchema>;
