<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";
  import { Bot, Globe, Zap } from "lucide-svelte";
  import { analyticsQueries } from "$lib/api/analytics/analytics.queries";
  import { botQueries } from "$lib/api/bots/bots.queries";
  import BotSummaryCard from "$lib/components/bot-summary-card.svelte";
  import PageHeader from "$lib/components/page-header.svelte";
  import StatCard from "$lib/components/stat-card.svelte";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import WeeklyActivityChart from "$lib/components/weekly-activity-chart.svelte";

  const botQuery = createQuery(() => botQueries.detail());
  const analyticsQuery = createQuery(() => analyticsQueries.weekly());

  const bot = $derived(botQuery.data);

  const totalTokens = $derived(
    (analyticsQuery.data?.tokensByDay ?? []).reduce(
      (sum, d) => sum + d.tokens,
      0
    )
  );

  const threadsThisWeek = $derived(
    (analyticsQuery.data?.threadsByDay ?? []).reduce(
      (sum, d) => sum + d.count,
      0
    )
  );

  const fmtTokens = (n: number) => {
    if (n >= 1_000_000) {
      return `${(n / 1_000_000).toFixed(1)}M`;
    }
    if (n >= 1000) {
      return `${(n / 1000).toFixed(1)}k`;
    }
    return n.toString();
  };
</script>

<PageHeader
  title="Bot Overview"
  description="Overview of your bot configuration and recent activity."
/>

<div class="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
  {#if analyticsQuery.isPending || botQuery.isPending}
    {#each [0, 1, 2, 3] as i (i)}
      <Skeleton class="h-22 rounded-lg" />
    {/each}
  {:else}
    <StatCard
      label="Tokens (7 days)"
      value={fmtTokens(totalTokens)}
      icon={Zap}
      description="Total tokens consumed"
    />
    <StatCard
      label="Threads (7 days)"
      value={threadsThisWeek}
      icon={Bot}
      description="Conversations this week"
    />
    <StatCard
      label="Platforms"
      value={bot?.platforms.length ?? 0}
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

<WeeklyActivityChart
  isPending={analyticsQuery.isPending}
  threadsByDay={analyticsQuery.data?.threadsByDay}
  tokensByDay={analyticsQuery.data?.tokensByDay}
/>

<BotSummaryCard
  {bot}
  isPending={botQuery.isPending}
  isError={botQuery.isError}
  onRefresh={() => botQuery.refetch()}
/>
