<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import {
    Bot,
    LayoutDashboard,
    List,
    MessageSquare,
    Plug,
  } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { botQueries } from "$lib/api/bots/bots.queries";
  import { betterAuthClient } from "$lib/better-auth-client";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";

  const botQuery = createQuery(() => botQueries.detail());

  const hasLocal = $derived(
    botQuery.data?.platforms.includes("local") ?? false
  );

  const handleLogout = async () => {
    try {
      await betterAuthClient.signOut();
    } finally {
      await goto("/login");
    }
  };
</script>

<nav
  class="flex h-12 shrink-0 items-center gap-1 border-b px-4"
  aria-label="Main navigation"
>
  <div class="flex items-center gap-2 pr-4 mr-2 border-r">
    <Bot size={16} class="text-primary" />
    <span class="text-sm font-semibold">
      {botQuery.data?.name ?? "Goodchat"}
    </span>
  </div>

  <a
    href="/"
    class={cn(
      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
      page.url.pathname === "/"
        ? "bg-accent text-accent-foreground font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    )}
  >
    <LayoutDashboard size={14} />
    Overview
  </a>

  <a
    href="/threads"
    class={cn(
      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
      page.url.pathname.startsWith("/threads")
        ? "bg-accent text-accent-foreground font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    )}
  >
    <List size={14} />
    Threads
  </a>

  <a
    href="/platforms"
    class={cn(
      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
      page.url.pathname.startsWith("/platforms")
        ? "bg-accent text-accent-foreground font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
    )}
  >
    <Plug size={14} />
    Platforms
  </a>

  {#if hasLocal}
    <a
      href="/chat"
      class={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        page.url.pathname.startsWith("/chat")
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
      )}
    >
      <MessageSquare size={14} />
      Chat
    </a>
  {/if}

  <Button
    variant="ghost"
    size="sm"
    class="ml-auto"
    onclick={() => handleLogout()}
  >
    Logout
  </Button>
</nav>
