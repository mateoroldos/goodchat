<script lang="ts">
  import "../app.css";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import { page } from "$app/state";
  import { authStatusContext } from "$lib/api/auth/auth.context";
  import type { AuthStatus } from "$lib/api/auth/auth.types";
  import AppNav from "$lib/components/app-nav.svelte";
  import type { LayoutData } from "./$types";

  let {
    data,
    children,
  }: {
    data: LayoutData & { authStatus: AuthStatus };
    children: import("svelte").Snippet;
  } = $props();

  authStatusContext.set({
    get authenticated() {
      return data.authStatus.authenticated;
    },
    get enabled() {
      return data.authStatus.enabled;
    },
  });
</script>

<QueryClientProvider client={data.queryClient}>
  <div class="flex h-svh overflow-hidden bg-background">
    <main class="flex-1 overflow-y-auto">
      {#if !page.url.pathname.startsWith("/login")}
        <AppNav />
      {/if}
      <div class="mx-auto max-w-5xl px-6 py-6">{@render children()}</div>
    </main>
  </div>
</QueryClientProvider>
