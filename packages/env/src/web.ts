import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "PUBLIC_",
  client: {
    PUBLIC_SERVER_URL: z.url(),
  },
  // biome-ignore lint/suspicious/noExplicitAny: `import.meta.env is typed as any, so we need to use any here`
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
