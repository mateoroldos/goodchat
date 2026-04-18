<script lang="ts">
  import { Bot as BotIcon, RefreshCw } from "lucide-svelte";
  import type { Bot } from "$lib/api/bots/bots.types";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import DiscordSetupGuide from "./discord-setup-guide.svelte";
  import PlatformBadge from "./platform-badge.svelte";

  interface Props {
    bot?: Bot | null;
    isError: boolean;
    isPending: boolean;
    onRefresh: () => unknown | Promise<unknown>;
  }

  const { bot, isError, isPending, onRefresh }: Props = $props();
</script>

<section>
  <div class="mb-3 flex items-center justify-between">
    <h2
      class="text-sm font-semibold uppercase tracking-wider text-muted-foreground"
    >
      Bot Summary
    </h2>
    {#if !isPending}
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 px-2 text-xs"
        onclick={onRefresh}
      >
        <RefreshCw size={11} />
        Refresh
      </Button>
    {/if}
  </div>

  {#if isPending}
    <Skeleton class="h-32 rounded-lg" />
  {:else if isError}
    <Card.Root class="border-destructive/30 bg-destructive/5">
      <Card.Content class="py-8 text-center">
        <p class="text-sm text-muted-foreground">Failed to load bot.</p>
        <Button variant="ghost" size="sm" class="mt-2" onclick={onRefresh}>
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
            <BotIcon size={20} />
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
