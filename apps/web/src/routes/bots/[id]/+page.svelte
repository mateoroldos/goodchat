<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { Bot, MessageSquare, PencilLine, RefreshCw } from "lucide-svelte";
  import { page } from "$app/stores";
  import { botsQueries } from "$lib/api/bots/bots.queries";
  import BotEditSheet from "$lib/components/bot-edit-sheet.svelte";
  import DiscordSetupGuide from "$lib/components/discord-setup-guide.svelte";
  import PageHeader from "$lib/components/page-header.svelte";
  import PlatformBadge from "$lib/components/platform-badge.svelte";
  import ThreadCard from "$lib/components/thread-card.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";

  const botId = $derived($page.params.id ?? "");

  const botQuery = createQuery(() => ({
    ...botsQueries.detail(botId),
    enabled: botId.length > 0,
  }));

  const limit = 50;

  const threadsQuery = createQuery(() => ({
    ...botsQueries.threads(botId, { limit }),
    enabled: botId.length > 0,
  }));

  let openEditSheet = $state(false);
</script>

{#if botQuery.isPending}
  <div class="space-y-4">
    <Skeleton class="h-8 w-1/3" />
    <Skeleton class="h-20 rounded-lg" />
    <div class="space-y-3">
      {#each [0, 1, 2] as i (i)}
        <Skeleton class="h-28 rounded-lg" />
      {/each}
    </div>
  </div>
{:else if botQuery.isError}
  <Card.Root class="border-destructive/30 bg-destructive/5">
    <Card.Content class="py-12 text-center">
      <p class="text-sm text-muted-foreground">
        Bot not found or failed to load.
      </p>
      <Button href="/" variant="ghost" size="sm" class="mt-3"
        >Back to dashboard</Button
      >
    </Card.Content>
  </Card.Root>
{:else if botQuery.data}
  {@const bot = botQuery.data}

  <PageHeader
    title={bot.name}
    breadcrumbs={[
      { label: "Dashboard", href: "/" },
      { label: bot.name },
    ]}
  >
    {#snippet actions()}
      <Button
        variant="outline"
        size="sm"
        class="gap-2"
        onclick={() => (openEditSheet = true)}
      >
        <PencilLine size={14} />
        Edit bot
      </Button>
    {/snippet}
  </PageHeader>

  <!-- Bot summary card -->
  <Card.Root class="mb-6">
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
          <p class="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {bot.prompt}
          </p>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Discord setup guide (only when Discord platform is active) -->
  {#if bot.platforms.includes("discord")}
    <div class="mb-6"><DiscordSetupGuide {bot} /></div>
  {/if}

  <!-- Threads section -->
  <section>
    <div class="mb-3 flex items-center justify-between">
      <h2
        class="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Conversation Threads
        {#if threadsQuery.data}
          <span
            class="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal normal-case"
          >
            {threadsQuery.data.length}
          </span>
        {/if}
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
          <p class="text-sm text-muted-foreground">
            No conversations yet for this bot.
          </p>
          <p class="mt-1 text-xs text-muted-foreground/60">
            Messages sent to
            <span class="font-medium text-foreground/70">{bot.name}</span>
            will appear here.
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

  <BotEditSheet {bot} bind:open={openEditSheet} />
{/if}
