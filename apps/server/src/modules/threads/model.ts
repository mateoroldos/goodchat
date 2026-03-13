import { t } from "elysia";

export const threadQueryModel = t.Object({
  limit: t.Optional(
    t.Numeric({
      minimum: 0,
      maximum: 200,
    })
  ),
});
