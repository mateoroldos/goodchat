<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { Bot, Globe, MessageSquare, RefreshCw, Zap } from "lucide-svelte";
  import { botQueries } from "$lib/api/bots/bots.queries";
  import { threadsQueries } from "$lib/api/threads/threads.queries";
  import DiscordSetupGuide from "$lib/components/discord-setup-guide.svelte";
  import PageHeader from "$lib/components/page-header.svelte";
  import PlatformBadge from "$lib/components/platform-badge.svelte";
  import StatCard from "$lib/components/stat-card.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";

  const botQuery = createQuery(() => botQueries.detail());
  const threadsQuery = createQuery(() => threadsQueries.list({ limit: 50 }));

  const bot = $derived(botQuery.data);
  const platformCount = $derived(botQuery.data?.platforms.length ?? 0);
  const threadCount = $derived(threadsQuery.data?.length ?? 0);
</script>

<PageHeader
  title="Bot Overview"
  description="Overview of your bot configuration and recent activity."
/>

<!-- Stats -->
<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
  {#if botQuery.isPending || threadsQuery.isPending}
    {#each [0, 1, 2] as i (i)}
      <Skeleton class="h-[88px] rounded-lg" />
    {/each}
  {:else}
    <StatCard
      label="Total Threads"
      value={threadCount}
      icon={MessageSquare}
      description="Last 50 conversations"
    />
    <StatCard
      label="Platforms"
      value={platformCount}
      icon={Globe}
      description="Connected platforms"
    />
    <StatCard
      label="Model"
      value={typeof bot?.model === "object" ? bot.model.modelId : (bot?.model ?? "—")}
      icon={Zap}
      description="Active inference model"
    />
  {/if}
</div>

<!-- Bot Summary -->
<section>
  <div class="mb-3 flex items-center justify-between">
    <h2
      class="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
    >
      Bot Summary
    </h2>
    {#if !botQuery.isPending}
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 px-2 text-xs"
        onclick={() => botQuery.refetch()}
      >
        <RefreshCw size={11} />
        Refresh
      </Button>
    {/if}
  </div>

  {#if botQuery.isPending}
    <Skeleton class="h-32 rounded-lg" />
  {:else if botQuery.isError}
    <Card.Root class="border-destructive/30 bg-destructive/5">
      <Card.Content class="py-8 text-center">
        <p class="text-sm text-muted-foreground">Failed to load bot.</p>
        <Button
          variant="ghost"
          size="sm"
          class="mt-2"
          onclick={() => botQuery.refetch()}
        >
          <RefreshCw size={14} />
          Retry
        </Button>
      </Card.Content>
    </Card.Root>
  {:else if bot}
    <Card.Root>
      <Card.Content class="p-5">
        <div class="flex items-start gap-4">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Bot size={20} />
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-2 flex flex-wrap items-center gap-2">
              <h2 class="text-sm font-semibold">{bot.name}</h2>
              {#each bot.platforms as platform (platform)}
                <PlatformBadge {platform} />
              {/each}
            </div>
            <p
              class="line-clamp-3 text-sm leading-relaxed text-muted-foreground"
            >
              {bot.prompt}
            </p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    {#if bot.platforms.includes("discord")}
      <div class="mt-6"><DiscordSetupGuide {bot} /></div>
    {/if}
  {/if}
</section>
