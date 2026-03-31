<script lang="ts">
  import { Bot, User } from "lucide-svelte";
  import type { Thread } from "$lib/api/threads/threads.types";
  import PlatformBadge from "./platform-badge.svelte";

  interface Props {
    thread: Thread;
  }

  const { thread }: Props = $props();

  const activityTimestamp = $derived(thread.lastActivityAt ?? thread.createdAt);
  const formattedTime = $derived.by(() => {
    try {
      return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(activityTimestamp));
    } catch {
      return activityTimestamp;
    }
  });
</script>

<article class="rounded-lg border border-border bg-card overflow-hidden">
  <!-- Thread header -->
  <div
    class="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 bg-card/60"
  >
    <div class="flex items-center gap-2 min-w-0">
      <div
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted"
      >
        <User size={11} class="text-muted-foreground" />
      </div>
      <span class="truncate font-mono text-xs text-muted-foreground"
        >{thread.userId}</span
      >
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <PlatformBadge platform={thread.platform} />
      <time class="text-[11px] text-muted-foreground tabular-nums"
        >{formattedTime}</time
      >
    </div>
  </div>

  <!-- Messages -->
  <div class="divide-y divide-border/50">
    <!-- User message -->
    <div class="px-4 py-3">
      <p
        class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60"
      >
        User
      </p>
      <p class="text-sm leading-relaxed whitespace-pre-wrap">{thread.text}</p>
    </div>

    <!-- Bot response -->
    <div class="px-4 py-3 bg-primary/3">
      <div class="mb-1 flex items-center gap-1.5">
        <div
          class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/20 text-primary"
        >
          <Bot size={8} />
        </div>
        <p
          class="text-[10px] font-semibold uppercase tracking-wider text-primary/70"
        >
          {thread.botName}
        </p>
      </div>
      <p class="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {thread.responseText}
      </p>
    </div>
  </div>
</article>
