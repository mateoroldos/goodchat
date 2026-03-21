<script lang="ts">
  import "../app.css";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import AppNav from "$lib/components/app-nav.svelte";
  import type { LayoutData } from "./$types";

  let {
    data,
    children,
  }: { data: LayoutData; children: import("svelte").Snippet } = $props();
</script>

<QueryClientProvider client={data.queryClient}>
  <div class="flex h-svh overflow-hidden bg-background">
    <main class="flex-1 overflow-y-auto">
      <AppNav />
      <div class="mx-auto max-w-5xl px-6 py-6">{@render children()}</div>
    </main>
  </div>
</QueryClientProvider>
