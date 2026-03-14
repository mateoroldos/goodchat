<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { Bot, Globe, MessageSquare, RefreshCw } from "lucide-svelte";
  import { botsQueries } from "$lib/api/bots/bots.queries";
  import { threadsQueries } from "$lib/api/threads/threads.queries";
  import BotCard from "$lib/components/bot-card.svelte";
  import PageHeader from "$lib/components/page-header.svelte";
  import StatCard from "$lib/components/stat-card.svelte";
  import ThreadCard from "$lib/components/thread-card.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";

  const botsQuery = createQuery(() => botsQueries.list());

  const limit = 10;

  const threadsQuery = createQuery(() => threadsQueries.list({ limit }));

  const platformCount = $derived(
    new Set((botsQuery.data ?? []).flatMap((b) => b.platforms)).size
  );

  const threadCountByBot = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const t of threadsQuery.data ?? []) {
      counts[t.botId] = (counts[t.botId] ?? 0) + 1;
    }
    return counts;
  });
</script>

<PageHeader
  title="Dashboard"
  description="Overview of your bots and recent activity."
/>

<!-- Stats -->
<div class="mb-8 grid grid-cols-3 gap-4">
  {#if botsQuery.isPending}
    {#each [0, 1, 2] as i (i)}
      <Skeleton class="h-[88px] rounded-lg" />
    {/each}
  {:else}
    <StatCard
      label="Bots"
      value={botsQuery.data?.length ?? 0}
      icon={Bot}
      description="Configured bots"
    />
    <StatCard
      label="Recent Threads"
      value={threadsQuery.data?.length ?? 0}
      icon={MessageSquare}
      description="Last 10 conversations"
    />
    <StatCard
      label="Platforms"
      value={platformCount}
      icon={Globe}
      description="Connected platforms"
    />
  {/if}
</div>

<!-- Bots -->
<section class="mb-8">
  <div class="mb-3 flex items-center justify-between">
    <h2
      class="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
    >
      Your Bots
    </h2>
  </div>

  {#if botsQuery.isPending}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each [0, 1, 2] as i (i)}
        <Skeleton class="h-48 rounded-lg" />
      {/each}
    </div>
  {:else if botsQuery.isError}
    <Card.Root class="border-destructive/30 bg-destructive/5">
      <Card.Content class="py-8 text-center">
        <p class="text-sm text-muted-foreground">Failed to load bots.</p>
        <Button
          variant="ghost"
          size="sm"
          class="mt-2"
          onclick={() => botsQuery.refetch()}
        >
          <RefreshCw size={14} />
          Retry
        </Button>
      </Card.Content>
    </Card.Root>
  {:else if botsQuery.data?.length === 0}
    <Card.Root>
      <Card.Content class="py-12 text-center">
        <Bot size={32} class="mx-auto mb-3 text-muted-foreground/40" />
        <p class="text-sm text-muted-foreground">No bots configured yet.</p>
        <p class="mt-1 text-xs text-muted-foreground/60">
          Add a bot config to the
          <code class="font-mono">/bots</code>
          directory.
        </p>
      </Card.Content>
    </Card.Root>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each botsQuery.data ?? [] as bot (bot.id)}
        <BotCard {bot} threadCount={threadCountByBot[bot.id] ?? 0} />
      {/each}
    </div>
  {/if}
</section>

<!-- Recent Activity -->
<section>
  <div class="mb-3 flex items-center justify-between">
    <h2
      class="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
    >
      Recent Activity
    </h2>
    {#if !threadsQuery.isPending}
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 px-2 text-xs"
        onclick={() => threadsQuery.refetch()}
      >
        <RefreshCw size={11} />
        Refresh
      </Button>
    {/if}
  </div>

  {#if threadsQuery.isPending}
    <div class="space-y-3">
      {#each [0, 1, 2] as i (i)}
        <Skeleton class="h-28 rounded-lg" />
      {/each}
    </div>
  {:else if threadsQuery.isError}
    <Card.Root class="border-destructive/30 bg-destructive/5">
      <Card.Content class="py-8 text-center">
        <p class="text-sm text-muted-foreground">Failed to load threads.</p>
      </Card.Content>
    </Card.Root>
  {:else if threadsQuery.data?.length === 0}
    <Card.Root>
      <Card.Content class="py-12 text-center">
        <MessageSquare
          size={32}
          class="mx-auto mb-3 text-muted-foreground/40"
        />
        <p class="text-sm text-muted-foreground">No conversations yet.</p>
        <p class="mt-1 text-xs text-muted-foreground/60">
          Send a message to one of your bots to see threads here.
        </p>
      </Card.Content>
    </Card.Root>
  {:else}
    <div class="space-y-3">
      {#each threadsQuery.data ?? [] as thread (thread.id)}
        <ThreadCard {thread} />
      {/each}
    </div>
  {/if}
</section>
