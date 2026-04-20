<script lang="ts">
  import { PLATFORM_METADATA } from "@goodchat/contracts/platform/platform-metadata";
  import { AlertTriangle, CheckCircle2 } from "lucide-svelte";
  import type { BotPlatform } from "$lib/api/bots/bots.types";
  import type { PlatformStatus } from "$lib/api/platforms/platforms.types";
  import { Badge } from "$lib/components/ui/badge";
  import * as Card from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { cn } from "$lib/utils";
  import PlatformBadge from "./platform-badge.svelte";

  interface Props {
    isPending: boolean;
    platform: BotPlatform;
    status?: PlatformStatus | null;
  }

  const { platform, status, isPending }: Props = $props();

  const meta = $derived(PLATFORM_METADATA[platform]);
  const color = $derived(meta?.color ?? "#71717a");

  const configured = $derived(status?.configured ?? false);
</script>

<a
  href="/platforms/{platform}"
  class="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
>
  <Card.Root
    class={cn(
      "border transition-colors hover:bg-accent/20 cursor-pointer h-full",
    )}
    style="border-color: {color}20;"
  >
    <Card.Header class="pb-3">
      <div class="flex items-start justify-between gap-3">
        <PlatformBadge {platform} />
        {#if isPending}
          <Skeleton class="h-5 w-16 rounded-full" />
        {:else if status}
          {#if configured}
            <Badge
              variant="outline"
              class="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-xs"
            >
              <CheckCircle2 size={10} />
              Configured
            </Badge>
          {:else}
            <Badge
              variant="outline"
              class="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs"
            >
              <AlertTriangle size={10} />
              Missing vars
            </Badge>
          {/if}
        {/if}
      </div>
    </Card.Header>
    <Card.Content class="pb-4">
      {#if isPending}
        <Skeleton class="h-4 w-3/4" />
      {:else if status && !configured}
        <p class="text-xs text-muted-foreground">
          {status.missingVars.length}
          env var{status.missingVars.length === 1 ? "" : "s"}
          missing
        </p>
      {:else}
        <p class="text-xs text-muted-foreground">
          {meta?.webhookPath ? `Webhook: ${meta.webhookPath}` : "No webhook required"}
        </p>
      {/if}
    </Card.Content>
  </Card.Root>
</a>
