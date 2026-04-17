<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import {
    AlertCircle,
    ArrowLeft,
    Bot,
    CheckCircle,
    Clock,
    Hash,
    User,
    Wrench,
    Zap,
  } from "lucide-svelte";
  import { page } from "$app/state";
  import { threadsQueries } from "$lib/api/threads/threads.queries";
  import PageHeader from "$lib/components/page-header.svelte";
  import PlatformBadge from "$lib/components/platform-badge.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";
  import { Separator } from "$lib/components/ui/separator";
  import { Skeleton } from "$lib/components/ui/skeleton";

  const threadId = $derived(page.params.threadId ?? "");

  const messagesQuery = createQuery(() => threadsQueries.messages(threadId));
  const runsQuery = createQuery(() => threadsQueries.runs(threadId));

  const runs = $derived(runsQuery.data ?? []);
  const messages = $derived(messagesQuery.data ?? []);

  const totalTokens = $derived(
    runs.reduce((sum, r) => sum + (r.totalTokens ?? 0), 0)
  );
  const totalInputTokens = $derived(
    runs.reduce((sum, r) => sum + (r.inputTokens ?? 0), 0)
  );
  const totalOutputTokens = $derived(
    runs.reduce((sum, r) => sum + (r.outputTokens ?? 0), 0)
  );
  const totalToolCalls = $derived(
    runs.reduce((sum, r) => sum + r.toolCalls.length, 0)
  );
  const totalDurationMs = $derived(
    runs.reduce((sum, r) => sum + (r.durationMs ?? 0), 0)
  );

  const fmt = (ts: string) => {
    try {
      return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(ts));
    } catch {
      return ts;
    }
  };

  const isBot = (role?: string) => role === "assistant";

  const fmtDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  };
</script>

<div class="mb-6">
  <a
    href="/threads"
    class="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
  >
    <ArrowLeft size={12} />
    All threads
  </a>
  <PageHeader
    title="Thread"
    description="Messages, AI runs, and tool calls for this conversation."
  />
</div>

<!-- Summary stats -->
{#if runsQuery.isPending}
  <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each [0, 1, 2, 3] as i (i)}
      <Skeleton class="h-20 rounded-lg" />
    {/each}
  </div>
{:else}
  <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center gap-2 mb-1">
          <Zap size={13} class="text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Total tokens</p>
        </div>
        <p class="text-xl font-bold">{totalTokens.toLocaleString()}</p>
        <p class="text-[10px] text-muted-foreground mt-0.5">
          {totalInputTokens.toLocaleString()}
          in / {totalOutputTokens.toLocaleString()} out
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center gap-2 mb-1">
          <Wrench size={13} class="text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Tool calls</p>
        </div>
        <p class="text-xl font-bold">{totalToolCalls}</p>
        <p class="text-[10px] text-muted-foreground mt-0.5">
          across {runs.length} run{runs.length === 1 ? "" : "s"}
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center gap-2 mb-1">
          <Clock size={13} class="text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Total duration</p>
        </div>
        <p class="text-xl font-bold">{fmtDuration(totalDurationMs)}</p>
        <p class="text-[10px] text-muted-foreground mt-0.5">
          {runs.length}
          AI run{runs.length === 1 ? "" : "s"}
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center gap-2 mb-1">
          <Hash size={13} class="text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Messages</p>
        </div>
        <p class="text-xl font-bold">{messages.length}</p>
        <p class="text-[10px] text-muted-foreground mt-0.5">in this thread</p>
      </Card.Content>
    </Card.Root>
  </div>
{/if}

<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
  <!-- Messages -->
  <section>
    <h2
      class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
    >
      Messages
    </h2>

    {#if messagesQuery.isPending}
      <div class="space-y-3">
        {#each [0, 1, 2] as i (i)}
          <Skeleton class="h-20 rounded-lg" />
        {/each}
      </div>
    {:else if messagesQuery.isError}
      <Card.Root class="border-destructive/30 bg-destructive/5">
        <Card.Content class="py-6 text-center">
          <p class="text-sm text-muted-foreground">Failed to load messages.</p>
        </Card.Content>
      </Card.Root>
    {:else if messages.length === 0}
      <Card.Root>
        <Card.Content class="py-10 text-center">
          <p class="text-sm text-muted-foreground">No messages found.</p>
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="space-y-2">
        {#each messages as msg (msg.id)}
          <Card.Root class={isBot(msg.role) ? "bg-primary/3" : ""}>
            <Card.Content class="p-4">
              <div class="mb-2 flex items-center gap-2">
                <div
                  class={[
                    "flex h-5 w-5 items-center justify-center rounded-full",
                    isBot(msg.role) ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {#if isBot(msg.role)}
                    <Bot size={10} />
                  {:else}
                    <User size={10} />
                  {/if}
                </div>
                <span
                  class="text-[10px] font-semibold uppercase tracking-wider"
                >
                  {isBot(msg.role) ? "Assistant" : "User"}
                </span>
                <span
                  class="ml-auto text-[10px] tabular-nums text-muted-foreground"
                >
                  {fmt(msg.createdAt)}
                </span>
              </div>
              <p class="text-sm leading-relaxed whitespace-pre-wrap">
                {msg.text}
              </p>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    {/if}
  </section>

  <!-- AI Runs -->
  <section>
    <h2
      class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
    >
      AI Runs
    </h2>

    {#if runsQuery.isPending}
      <div class="space-y-3">
        {#each [0, 1] as i (i)}
          <Skeleton class="h-32 rounded-lg" />
        {/each}
      </div>
    {:else if runsQuery.isError}
      <Card.Root class="border-destructive/30 bg-destructive/5">
        <Card.Content class="py-6 text-center">
          <p class="text-sm text-muted-foreground">Failed to load runs.</p>
        </Card.Content>
      </Card.Root>
    {:else if runs.length === 0}
      <Card.Root>
        <Card.Content class="py-10 text-center">
          <p class="text-sm text-muted-foreground">No AI runs found.</p>
        </Card.Content>
      </Card.Root>
    {:else}
      <div class="space-y-3">
        {#each runs as run (run.id)}
          <Card.Root>
            <Card.Content class="p-4">
              <!-- Run header -->
              <div class="mb-3 flex items-center gap-2">
                <Badge variant="outline" class="font-mono text-[10px]">
                  {run.modelId}
                </Badge>
                <Badge variant="outline" class="text-[10px]">
                  {run.mode}
                </Badge>
                {#if run.hadError}
                  <AlertCircle size={13} class="text-destructive ml-auto" />
                {:else}
                  <CheckCircle size={13} class="text-green-500 ml-auto" />
                {/if}
              </div>

              <!-- Token + timing row -->
              <div class="mb-3 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-md bg-muted/50 px-2 py-1.5">
                  <p class="text-[10px] text-muted-foreground">Input</p>
                  <p class="text-xs font-semibold tabular-nums">
                    {(run.inputTokens ?? 0).toLocaleString()}
                  </p>
                </div>
                <div class="rounded-md bg-muted/50 px-2 py-1.5">
                  <p class="text-[10px] text-muted-foreground">Output</p>
                  <p class="text-xs font-semibold tabular-nums">
                    {(run.outputTokens ?? 0).toLocaleString()}
                  </p>
                </div>
                <div class="rounded-md bg-muted/50 px-2 py-1.5">
                  <p class="text-[10px] text-muted-foreground">Duration</p>
                  <p class="text-xs font-semibold tabular-nums">
                    {run.durationMs ? fmtDuration(run.durationMs) : "—"}
                  </p>
                </div>
              </div>

              <!-- Tool calls -->
              {#if run.toolCalls.length > 0}
                <Separator class="mb-3" />
                <p
                  class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Tool calls ({run.toolCalls.length})
                </p>
                <div class="space-y-1.5">
                  {#each run.toolCalls as tc (tc.id)}
                    <div
                      class="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2"
                    >
                      <Wrench
                        size={11}
                        class="shrink-0 text-muted-foreground"
                      />
                      <span class="font-mono text-xs">{tc.toolName}</span>
                      {#if tc.status === "error"}
                        <AlertCircle
                          size={11}
                          class="ml-auto text-destructive"
                        />
                      {:else}
                        <CheckCircle size={11} class="ml-auto text-green-500" />
                      {/if}
                      {#if tc.durationMs}
                        <span
                          class="text-[10px] tabular-nums text-muted-foreground"
                        >
                          {fmtDuration(tc.durationMs)}
                        </span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}

              {#if run.hadError && run.errorMessage}
                <Separator class="my-3" />
                <div
                  class="rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive"
                >
                  {run.errorMessage}
                </div>
              {/if}

              <p class="mt-3 text-[10px] tabular-nums text-muted-foreground">
                {fmt(run.createdAt)}
              </p>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
    {/if}
  </section>
</div>
