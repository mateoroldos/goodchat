import z from "zod";
import type { GoodchatHooks } from "./types";

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

export type GoodchatHooksSchemaInput = z.infer<typeof goodchatHooksSchema>;
