import { redirect } from "@sveltejs/kit";
import { createQueryClient } from "$lib/query-client";
import type { LayoutLoad } from "./$types";

export const prerender = false;
export const ssr = false;

export const load: LayoutLoad = async ({ fetch, url }) => {
  const queryClient = createQueryClient();

  const isLoginRoute = url.pathname === "/login";
  const sessionResponse = await fetch("/api/auth/get-session", {
    credentials: "include",
  });

  if (sessionResponse.status === 404) {
    if (isLoginRoute) {
      throw redirect(307, "/");
    }

    return { queryClient };
  }

  if (!sessionResponse.ok) {
    if (!isLoginRoute) {
      throw redirect(307, "/login");
    }

    return { queryClient };
  }

  const session = (await sessionResponse.json().catch(() => null)) as {
    session?: unknown;
    user?: unknown;
  } | null;
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
