<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { MessageSquare, RefreshCw } from "lucide-svelte";
  import { threadsQueries } from "$lib/api/threads/threads.queries";
  import PageHeader from "$lib/components/page-header.svelte";
  import PlatformBadge from "$lib/components/platform-badge.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import * as Table from "$lib/components/ui/table";

  const query = createQuery(() => threadsQueries.list({ limit: 200 }));

  const threads = $derived(query.data ?? []);

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
</script>

<PageHeader
  title="Threads"
  description="All conversation threads for your bot."
/>

<div class="mb-4 flex justify-end">
  {#if !query.isPending}
    <Button
      variant="ghost"
      size="sm"
      class="h-7 gap-1.5 px-2 text-xs"
      onclick={() => query.refetch()}
    >
      <RefreshCw size={11} />
      Refresh
    </Button>
  {/if}
</div>

{#if query.isPending}
  <div class="space-y-2">
    {#each [0, 1, 2, 3, 4] as i (i)}
      <Skeleton class="h-12 rounded-lg" />
    {/each}
  </div>
{:else if query.isError}
  <Card.Root class="border-destructive/30 bg-destructive/5">
    <Card.Content class="py-8 text-center">
      <p class="text-sm text-muted-foreground">Failed to load threads.</p>
      <Button
        variant="ghost"
        size="sm"
        class="mt-2"
        onclick={() => query.refetch()}
      >
        <RefreshCw size={14} />
        Retry
      </Button>
    </Card.Content>
  </Card.Root>
{:else if threads.length === 0}
  <Card.Root>
    <Card.Content class="py-16 text-center">
      <MessageSquare size={32} class="mx-auto mb-3 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">No conversations yet.</p>
      <p class="mt-1 text-xs text-muted-foreground/60">
        Send a message to your bot to see threads here.
      </p>
    </Card.Content>
  </Card.Root>
{:else}
  <Card.Root class="overflow-hidden">
    <Table.Root>
      <Table.Header>
        <Table.Row>
          <Table.Head>User</Table.Head>
          <Table.Head>Platform</Table.Head>
          <Table.Head class="max-w-xs">Last message</Table.Head>
          <Table.Head class="max-w-xs">Response</Table.Head>
          <Table.Head class="text-right">Last activity</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each threads as thread (thread.id)}
          <Table.Row
            class="cursor-pointer hover:bg-muted/50"
            onclick={() => (window.location.href = `/threads/${thread.id}`)}
          >
            <Table.Cell class="font-mono text-xs text-muted-foreground">
              {thread.userId}
            </Table.Cell>
            <Table.Cell>
              <PlatformBadge platform={thread.platform} />
            </Table.Cell>
            <Table.Cell class="max-w-xs">
              <p class="truncate text-sm">{thread.text}</p>
            </Table.Cell>
            <Table.Cell class="max-w-xs">
              <p class="truncate text-sm text-muted-foreground">
                {thread.responseText}
              </p>
            </Table.Cell>
            <Table.Cell
              class="text-right text-xs tabular-nums text-muted-foreground"
            >
              {fmt(thread.lastActivityAt ?? thread.createdAt)}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </Card.Root>
{/if}
