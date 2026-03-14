import { t } from "elysia";

const DEFAULT_THREAD_LIMIT = 50;

export const botParamsModel = t.Object({
  id: t.String(),
});

export const botThreadsQueryModel = t.Object({
  limit: t.Numeric({ minimum: 0, maximum: 200, default: DEFAULT_THREAD_LIMIT }),
});
