import { redirect } from "@sveltejs/kit";
import { betterAuthClient } from "$lib/better-auth-client";
import { createQueryClient } from "$lib/query-client";
import type { LayoutLoad } from "./$types";

export const prerender = false;
export const ssr = false;

export const load: LayoutLoad = async ({ url }) => {
  const queryClient = createQueryClient();

  const isLoginRoute = url.pathname === "/login";
  const { data: session, error } = await betterAuthClient.getSession();

  if (error) {
    if (!isLoginRoute) {
      throw redirect(307, "/login");
    }

    return { queryClient };
  }

  const isAuthenticated = Boolean(session?.session && session?.user);

  if (!isAuthenticated) {
    if (!isLoginRoute) {
      throw redirect(307, "/login");
    }

    return { queryClient };
  }

  if (isLoginRoute) {
    throw redirect(307, "/");
  }

  return { queryClient };
};
