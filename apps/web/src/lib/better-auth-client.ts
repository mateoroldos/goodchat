import { createAuthClient } from "better-auth/svelte";

export const betterAuthClient = createAuthClient({
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
  },
});
