<script lang="ts">
  import "../app.css";
  import { QueryClientProvider } from "@tanstack/svelte-query";
  import AppSidebar from "$lib/components/app-sidebar.svelte";
  import { createQueryClient } from "$lib/query-client";

  const { children } = $props();

  const queryClient = createQueryClient();
</script>

<QueryClientProvider client={queryClient}>
  <div class="flex h-svh overflow-hidden bg-background">
    <AppSidebar />
    <main class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-5xl px-6 py-6">{@render children()}</div>
    </main>
  </div>
</QueryClientProvider>
