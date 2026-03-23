import z from "zod";
import type { GoodbotHooks } from "./types";

const afterMessageSchema = z.custom<NonNullable<GoodbotHooks["afterMessage"]>>(
  (value) => typeof value === "function",
  {
    message: "Expected a function",
  }
);

const beforeMessageSchema = z.custom<
  NonNullable<GoodbotHooks["beforeMessage"]>
>((value) => typeof value === "function", {
  message: "Expected a function",
});

export const goodbotHooksSchema = z.object({
  afterMessage: afterMessageSchema.optional(),
  beforeMessage: beforeMessageSchema.optional(),
});

export type GoodbotHooksSchemaInput = z.infer<typeof goodbotHooksSchema>;
