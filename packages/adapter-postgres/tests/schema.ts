import { postgresSchema } from "@goodchat/core/schema";

export const goodchatMeta = postgresSchema.goodchatMeta;
export const messages = postgresSchema.messages;
export const threads = postgresSchema.threads;
