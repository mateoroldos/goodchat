<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { botQueries } from "$lib/api/bots/bots.queries";
  import type { BotPlatform } from "$lib/api/bots/bots.types";
  import { platformsQueries } from "$lib/api/platforms/platforms.queries";
  import PageHeader from "$lib/components/page-header.svelte";
  import PlatformCard from "$lib/components/platform-card.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";

  const botQuery = createQuery(() => botQueries.detail());
  const platforms = $derived((botQuery.data?.platforms ?? []) as BotPlatform[]);

  const statusQueries = $derived(
    platforms.map((p) => ({
      platform: p,
      query: createQuery(() => platformsQueries.status(p)),
    }))
  );
</script>

<div class="p-6">
  <PageHeader
    title="Platforms"
    description="Active messaging platforms for this bot."
  />

  {#if botQuery.isPending}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each { length: 3 } as _, i (i)}
        <Skeleton class="h-28 rounded-lg" />
      {/each}
    </div>
  {:else if platforms.length === 0}
    <p class="text-sm text-muted-foreground">
      No platforms configured. Add one in your bot config.
    </p>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each statusQueries as { platform, query } (platform)}
        <PlatformCard
          {platform}
          status={query.data ?? null}
          isPending={query.isPending}
        />
      {/each}
    </div>
  {/if}
</div>
