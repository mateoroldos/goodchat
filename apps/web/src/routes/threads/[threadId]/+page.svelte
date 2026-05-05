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
  import type { Message, Run } from "$lib/api/threads/threads.types";
  import PageHeader from "$lib/components/page-header.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Separator } from "$lib/components/ui/separator";
  import { Skeleton } from "$lib/components/ui/skeleton";

  const threadId = $derived(page.params.threadId ?? "");

  const messagesQuery = createQuery(() => threadsQueries.messages(threadId));
  const runsQuery = createQuery(() => threadsQueries.runs(threadId));

  const runs = $derived(runsQuery.data ?? []);
  const messages = $derived(messagesQuery.data ?? []);

  // Map assistantMessageId -> run (runs sorted desc, so first = most recent)
  const runByMessageId = $derived(
    runs.reduce((map, run) => {
      if (!map.has(run.assistantMessageId)) {
        map.set(run.assistantMessageId, run);
      }
      return map;
    }, new Map<string, Run>())
  );

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

  const getResponseSource = (metadata: Message["metadata"] | undefined) => {
    const source = metadata?.responseSource;
    if (source?.kind !== "hook") {
      return undefined;
    }

    return {
      hook: source.hook ?? "hook",
      pluginKey: source.pluginKey,
      pluginName: source.pluginName,
    };
  };

  const enrichedMessages = $derived(
    messages.map((msg) => ({
      ...msg,
      isBot: msg.role === "assistant",
      responseSource: getResponseSource(msg.metadata),
      run: msg.role === "assistant" ? runByMessageId.get(msg.id) : undefined,
    }))
  );

  const fmt = (ts: string) => {
    try {
      return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(ts));
    } catch {
      return ts;
    }
  };

  const fmtDuration = (ms: number) =>
    ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
</script>

<div class="mb-6">
  <a
    href="/threads"
    class="mb-4 flex w-fit items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
  >
    <ArrowLeft size={12} />
    All threads
  </a>
  <PageHeader
    title="Thread"
    description="Messages and AI runs for this conversation."
  />
</div>

<!-- Summary stats -->
{#if runsQuery.isPending || messagesQuery.isPending}
  <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each [0, 1, 2, 3] as i (i)}
      <Skeleton class="h-20 rounded-lg" />
    {/each}
  </div>
{:else}
  <div class="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="mb-1 flex items-center gap-2">
          <Zap size={13} class="text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Total tokens</p>
        </div>
        <p class="text-xl font-bold">{totalTokens.toLocaleString()}</p>
        <p class="mt-0.5 text-[10px] text-muted-foreground">
          {totalInputTokens.toLocaleString()}
          in / {totalOutputTokens.toLocaleString()} out
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="p-4">
        <div class="mb-1 flex items-center gap-2">
          <Wrench size={13} class="text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Tool calls</p>
        </div>
        <p class="text-xl font-bold">{totalToolCalls}</p>
        <p class="mt-0.5 text-[10px] text-muted-foreground">
          across {runs.length} run{runs.length === 1 ? "" : "s"}
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="p-4">
        <div class="mb-1 flex items-center gap-2">
          <Clock size={13} class="text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Total duration</p>
        </div>
        <p class="text-xl font-bold">{fmtDuration(totalDurationMs)}</p>
        <p class="mt-0.5 text-[10px] text-muted-foreground">
          {runs.length}
          AI run{runs.length === 1 ? "" : "s"}
        </p>
      </Card.Content>
    </Card.Root>

    <Card.Root>
      <Card.Content class="p-4">
        <div class="mb-1 flex items-center gap-2">
          <Hash size={13} class="text-muted-foreground" />
          <p class="text-xs text-muted-foreground">Messages</p>
        </div>
        <p class="text-xl font-bold">{messages.length}</p>
        <p class="mt-0.5 text-[10px] text-muted-foreground">in this thread</p>
      </Card.Content>
    </Card.Root>
  </div>
{/if}

<!-- Conversation -->
<section>
  <h2
    class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
  >
    Conversation
  </h2>

  {#if messagesQuery.isPending}
    <div class="space-y-4">
      {#each [0, 1, 2, 3] as i (i)}
        <Skeleton
          class={["h-16 w-3/4 rounded-2xl", i % 2 === 0 ? "ml-auto" : ""].join(" ")}
        />
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
    <div class="space-y-3">
      {#each enrichedMessages as msg (msg.id)}
        <div
          class={["flex flex-col", msg.isBot ? "items-start" : "items-end"].join(" ")}
        >
          <!-- Role label -->
          <div
            class={[
              "mb-1 flex items-center gap-1.5 px-1",
              msg.isBot ? "" : "flex-row-reverse",
            ].join(" ")}
          >
            <div
              class={[
                "flex h-5 w-5 items-center justify-center rounded-full",
                msg.isBot ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {#if msg.isBot}
                <Bot size={10} />
              {:else}
                <User size={10} />
              {/if}
            </div>
            <span
              class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              {msg.isBot ? "Assistant" : "User"}
            </span>
            <span class="text-[10px] tabular-nums text-muted-foreground/60">
              {fmt(msg.createdAt)}
            </span>
          </div>

          <!-- Bubble -->
          <div
            class={[
              "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
              msg.isBot
                ? "rounded-tl-sm bg-card ring-1 ring-border"
                : "rounded-tr-sm bg-primary text-primary-foreground",
            ].join(" ")}
          >
            <p class="whitespace-pre-wrap">{msg.text}</p>
          </div>

          {#if msg.isBot && msg.responseSource}
            <div class="ml-6 mt-1.5 max-w-[72%]">
              <div
                class="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[10px] text-amber-700 dark:text-amber-300"
              >
                <Zap size={10} class="shrink-0" />
                <span class="font-semibold uppercase tracking-wider"
                  >Hook response</span
                >
                <span class="opacity-50">·</span>
                <span class="font-mono">{msg.responseSource.hook}</span>
                {#if msg.responseSource.pluginName}
                  <span class="opacity-50">·</span>
                  <span>plugin</span>
                  <span class="font-mono">{msg.responseSource.pluginName}</span>
                {/if}
                {#if msg.responseSource.pluginKey}
                  <span class="opacity-50">/</span>
                  <span class="font-mono opacity-80"
                    >{msg.responseSource.pluginKey}</span
                  >
                {/if}
              </div>
            </div>
          {/if}

          <!-- AI run details linked to this bot message -->
          {#if msg.run}
            <div class="ml-6 mt-1.5 max-w-[72%]">
              <div
                class="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground"
              >
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span class="font-mono font-medium text-foreground/70"
                    >{msg.run.modelId}</span
                  >
                  <span class="opacity-40">·</span>
                  <span>{msg.run.mode}</span>
                  {#if msg.run.durationMs}
                    <span class="opacity-40">·</span>
                    <span class="tabular-nums"
                      >{fmtDuration(msg.run.durationMs)}</span
                    >
                  {/if}
                  <span class="opacity-40">·</span>
                  <span class="tabular-nums">
                    {(msg.run.inputTokens ?? 0).toLocaleString()}↑&nbsp;{(msg.run.outputTokens ??
                      0).toLocaleString()}↓
                  </span>
                  <span class="ml-auto shrink-0">
                    {#if msg.run.hadError}
                      <AlertCircle size={10} class="text-destructive" />
                    {:else}
                      <CheckCircle size={10} class="text-green-500" />
                    {/if}
                  </span>
                </div>

                {#if msg.run.toolCalls.length > 0}
                  <Separator class="my-1.5 opacity-30" />
                  <div class="space-y-1">
                    {#each msg.run.toolCalls as tc (tc.id)}
                      <div class="flex items-center gap-1.5">
                        <Wrench size={9} class="shrink-0 opacity-60" />
                        <span class="font-mono">{tc.toolName}</span>
                        {#if tc.durationMs}
                          <span class="tabular-nums opacity-50"
                            >{fmtDuration(tc.durationMs)}</span
                          >
                        {/if}
                        <span class="ml-auto shrink-0">
                          {#if tc.status === "error"}
                            <AlertCircle size={9} class="text-destructive" />
                          {:else}
                            <CheckCircle size={9} class="text-green-500" />
                          {/if}
                        </span>
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if msg.run.hadError && msg.run.errorMessage}
                  <Separator class="my-1.5 opacity-30" />
                  <p class="text-destructive">{msg.run.errorMessage}</p>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>
