<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { Bot, LayoutDashboard, Zap } from "lucide-svelte";
  import { page } from "$app/state";
  import { botsQueries } from "$lib/api/bots/bots.queries";
  import { Separator } from "$lib/components/ui/separator";
  import { Skeleton } from "$lib/components/ui/skeleton";

  const botsQuery = createQuery(() => botsQueries.list());

  const isActive = (href: string) => page.url.pathname === href;
  const isBotActive = (id: string) =>
    page.url.pathname.startsWith(`/bots/${id}`);
</script>

<aside
  class="flex h-full w-[220px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
>
  <!-- Logo -->
  <div class="flex items-center gap-2 px-4 py-4">
    <div
      class="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <Zap size={14} />
    </div>
    <span class="text-sm font-semibold tracking-tight">goodchat</span>
  </div>

  <Separator />

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto px-2 py-3">
    <!-- Dashboard -->
    <a
      href="/"
      class={[
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        isActive("/")
          ? "bg-primary/15 text-primary font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      ]}
    >
      <LayoutDashboard size={15} />
      Dashboard
    </a>

    <!-- Bots section -->
    <div class="mt-4">
      <p
        class="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
      >
        Bots
      </p>

      {#if botsQuery.isPending}
        <div class="space-y-1 px-3 py-1">
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-4 w-1/2" />
        </div>
      {:else if botsQuery.data}
        {#each botsQuery.data as bot (bot.id)}
          <a
            href="/bots/{bot.id}"
            class={[
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              isBotActive(bot.id)
                ? "bg-primary/15 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ]}
          >
            <Bot size={14} />
            <span class="truncate">{bot.name}</span>
          </a>
        {/each}
      {/if}
    </div>
  </nav>

  <Separator />

  <!-- Footer -->
  <div class="px-4 py-3">
    <p class="text-[11px] text-muted-foreground/40">goodchat · v0.1</p>
  </div>
</aside>
