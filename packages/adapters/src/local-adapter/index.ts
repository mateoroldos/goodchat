import { Result } from "better-result";
import { InvalidPayloadError } from "./errors";
import type { LocalAdapterService } from "./interface";
import { webhookSchema } from "./schema";

export class DefaultLocalAdapterService implements LocalAdapterService {
  parseWebhook(payload: unknown) {
    const parsed = webhookSchema.safeParse(payload);

    if (!parsed.success) {
      return Result.err(
        new InvalidPayloadError(
          "Invalid webhook payload",
          parsed.error.issues.map((issue) => issue.message)
        )
      );
    }

    return Result.ok({
      ...parsed.data,
      platform: "local" as const,
    });
  }
}

export type { LocalAdapterService } from "./interface";
