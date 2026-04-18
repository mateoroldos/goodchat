<script lang="ts">
  import { BarChart } from "layerchart";
  import * as Card from "$lib/components/ui/card";
  import * as Chart from "$lib/components/ui/chart";
  import { Skeleton } from "$lib/components/ui/skeleton";

  interface DayCount {
    count: number;
    date: string;
  }

  interface DayTokens {
    date: string;
    tokens: number;
  }

  interface Props {
    isPending: boolean;
    threadsByDay?: DayCount[];
    tokensByDay?: DayTokens[];
  }

  const { isPending, threadsByDay = [], tokensByDay = [] }: Props = $props();

  const chartConfig = {
    threads: {
      label: "Threads",
      color: "var(--chart-1)",
    },
    tokensK: {
      label: "Tokens (k)",
      color: "var(--chart-2)",
    },
  } satisfies Chart.ChartConfig;

  const toLocalDate = (dateKey: string) => {
    const [year, month, day] = dateKey.split("-").map((part) => Number(part));
    return new Date(year, month - 1, day);
  };

  const toDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const chartData = $derived.by(() => {
    const allDates = [
      ...threadsByDay.map((item) => item.date),
      ...tokensByDay.map((item) => item.date),
    ];

    const threadMap: Record<string, number> = Object.fromEntries(
      threadsByDay.map((item) => [item.date, item.count])
    );
    const tokenMap: Record<string, number> = Object.fromEntries(
      tokensByDay.map((item) => [item.date, item.tokens])
    );

    const latestDateKey =
      allDates.length > 0 ? [...allDates].sort().at(-1) : undefined;
    const end = latestDateKey ? toLocalDate(latestDateKey) : new Date();

    const todayKey = toDateKey(new Date());

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() - (6 - index)
      );
      const dateKey = toDateKey(date);
      const tokens = tokenMap[dateKey] ?? 0;
      return {
        date: dateKey,
        isToday: dateKey === todayKey,
        label:
          dateKey === todayKey
            ? "Today"
            : date.toLocaleDateString("en", { weekday: "short" }),
        threads: threadMap[dateKey] ?? 0,
        tokens,
        tokensK: Number((tokens / 1000).toFixed(1)),
      };
    });
  });

  const hasData = $derived(
    chartData.some((day) => day.threads > 0 || day.tokens > 0)
  );
</script>

<section class="mb-8">
  <h2
    class="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
  >
    Tokens and Threads per Day
  </h2>

  {#if isPending}
    <Skeleton class="h-28 rounded-lg" />
  {:else}
    <Card.Root>
      <Card.Content class="p-5">
        {#if !hasData}
          <p class="py-6 text-center text-sm text-muted-foreground">
            No activity data available for this period.
          </p>
        {:else}
          <Chart.Container config={chartConfig} class="min-h-55 w-full">
            <BarChart
              data={chartData}
              x="label"
              axis="x"
              legend
              seriesLayout="group"
              series={[
                {
                  key: "threads",
                  label: chartConfig.threads.label,
                  color: "var(--color-threads)",
                },
                {
                  key: "tokensK",
                  label: chartConfig.tokensK.label,
                  color: "var(--color-tokensK)",
                },
              ]}
            >
              {#snippet tooltip()}
                <Chart.Tooltip />
              {/snippet}
            </BarChart>
          </Chart.Container>
          <p class="mt-2 text-xs text-muted-foreground">
            Tokens are shown in thousands.
          </p>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}
</section>
