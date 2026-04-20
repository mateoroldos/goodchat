import { redirect } from "@sveltejs/kit";
import { authQueries } from "$lib/api/auth/auth.queries";
import type { AuthStatus } from "$lib/api/auth/auth.types";
import { createQueryClient } from "$lib/query-client";
import type { LayoutLoad } from "./$types";

export const prerender = false;
export const ssr = false;

export const load: LayoutLoad = async ({ url }) => {
  const queryClient = createQueryClient();
  const fallbackAuthStatus: AuthStatus = {
    authenticated: true,
    enabled: false,
  };

  const isLoginRoute = url.pathname === "/login";
  let authStatus = fallbackAuthStatus;

  try {
    authStatus = await queryClient.fetchQuery(authQueries.status());
  } catch {
    return { authStatus, queryClient };
  }

  if (authStatus.enabled && !authStatus.authenticated) {
    if (!isLoginRoute) {
      throw redirect(307, "/login");
    }

    return { authStatus, queryClient };
  }

  if (isLoginRoute) {
    throw redirect(307, "/");
  }

  return { authStatus, queryClient };
};
