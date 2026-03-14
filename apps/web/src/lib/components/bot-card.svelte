<script lang="ts">
  import { ArrowRight, Bot, MessageSquare } from "lucide-svelte";
  import type { Bot as BotType } from "$lib/api/bots/bots.types";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import PlatformBadge from "./platform-badge.svelte";

  interface Props {
    bot: BotType;
    threadCount?: number;
  }

  const { bot, threadCount = 0 }: Props = $props();

  const promptExcerpt = $derived(
    bot.prompt.length > 100 ? `${bot.prompt.slice(0, 100)}…` : bot.prompt
  );
</script>

<Card.Root
  class="group flex flex-col transition-colors hover:border-primary/30 hover:bg-card/80"
>
  <Card.Header class="pb-3">
    <div class="flex items-start gap-3">
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
      >
        <Bot size={18} />
      </div>
      <div class="min-w-0 flex-1">
        <Card.Title class="truncate text-sm">{bot.name}</Card.Title>
        <div class="mt-1.5 flex flex-wrap gap-1">
          {#each bot.platforms as platform (platform)}
            <PlatformBadge {platform} />
          {/each}
        </div>
      </div>
    </div>
  </Card.Header>

  <Card.Content class="flex-1 pb-3">
    <p class="text-xs leading-relaxed text-muted-foreground">{promptExcerpt}</p>
  </Card.Content>

  <Card.Footer class="justify-between pt-3 border-t border-border">
    <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
      <MessageSquare size={12} />
      <span>{threadCount} thread{threadCount !== 1 ? "s" : ""}</span>
    </div>
    <Button
      href="/bots/{bot.id}"
      variant="ghost"
      size="sm"
      class="h-7 gap-1 px-2 text-xs group-hover:text-primary"
    >
      View
      <ArrowRight size={12} />
    </Button>
  </Card.Footer>
</Card.Root>
