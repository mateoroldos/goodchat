<script lang="ts">
  import type { Platform } from "@goodchat/contracts/config/types";
  import { PLATFORM_METADATA } from "@goodchat/contracts/platform/platform-metadata";
  import { createQuery } from "@tanstack/svelte-query";
  import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    HelpCircle,
    Loader2,
    RefreshCw,
  } from "lucide-svelte";
  import { page } from "$app/state";
  import { platformsQueries } from "$lib/api/platforms/platforms.queries";
  import CopyButton from "$lib/components/copy-button.svelte";
  import PageHeader from "$lib/components/page-header.svelte";
  import PlatformBadge from "$lib/components/platform-badge.svelte";
  import PlatformSetupGuide from "$lib/components/platform-setup-guide.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import { cn } from "$lib/utils";

  const platformId = $derived(
    (page.params as Record<string, string>).platformId as Platform
  );
  const meta = $derived(PLATFORM_METADATA[platformId]);

  const statusQuery = createQuery(() => platformsQueries.status(platformId));

  const webhookUrl = $derived(
    meta?.webhookPath && typeof window !== "undefined"
      ? `${window.location.origin}${meta.webhookPath}`
      : (meta?.webhookPath ?? null)
  );

  const missingVars = $derived(statusQuery.data?.missingVars ?? []);
  const missingSet = $derived(new Set(missingVars));
</script>

{#if !meta}
  <div class="p-6">
    <p class="text-sm text-muted-foreground">Unknown platform: {platformId}</p>
  </div>
{:else}
  <div class="p-6 max-w-3xl">
    <PageHeader
      title={meta.label}
      breadcrumbs={[
        { label: "Platforms", href: "/platforms" },
        { label: meta.label },
      ]}
    >
      {#snippet actions()}
        <PlatformBadge platform={platformId} />
      {/snippet}
    </PageHeader>

    <div class="mb-6 flex flex-wrap items-center gap-2">
      {#if statusQuery.isPending}
        <Skeleton class="h-6 w-28 rounded-full" />
        <Skeleton class="h-6 w-24 rounded-full" />
      {:else if statusQuery.data}
        {#if statusQuery.data.configured}
          <Badge
            variant="outline"
            class="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          >
            <CheckCircle2 size={12} />
            Configured
          </Badge>
        {:else}
          <Badge
            variant="outline"
            class="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-400"
          >
            <AlertTriangle size={12} />
            Not configured
          </Badge>
        {/if}

        {#if meta.canVerifyConnection}
          {#if statusQuery.data.connected === true}
            <Badge
              variant="outline"
              class="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            >
              <CheckCircle2 size={12} />
              Connected
            </Badge>
          {:else if statusQuery.data.connected === false}
            <Badge
              variant="outline"
              class="gap-1.5 border-red-500/40 bg-red-500/10 text-red-400"
            >
              <AlertTriangle size={12} />
              Not connected
            </Badge>
          {/if}
        {:else}
          <Badge
            variant="outline"
            class="gap-1.5 border-zinc-600/40 bg-zinc-600/10 text-zinc-400"
          >
            <HelpCircle size={12} />
            Connection unverifiable
          </Badge>
        {/if}
      {/if}

      {#if meta.canVerifyConnection}
        <Button
          variant="outline"
          size="sm"
          class="ml-auto h-7 gap-1.5 text-xs"
          onclick={() => statusQuery.refetch()}
          disabled={statusQuery.isFetching}
        >
          {#if statusQuery.isFetching}
            <Loader2 size={12} class="animate-spin" />
          {:else}
            <RefreshCw size={12} />
          {/if}
          Check connection
        </Button>
      {/if}
    </div>

    {#if missingVars.length > 0}
      <div
        class="mb-6 flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3"
      >
        <AlertTriangle size={14} class="mt-0.5 shrink-0 text-amber-500" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-amber-500">
            Missing environment variables
          </p>
          <p class="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
            Set these in your <code class="font-mono">.env</code> file to enable
            this platform:
          </p>
          <div class="mt-2 flex flex-wrap gap-1.5">
            {#each missingVars as key (key)}
              <code
                class="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[11px] text-amber-400"
                >{key}</code
              >
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <PlatformSetupGuide {platformId} {webhookUrl} />

    {#if webhookUrl}
      <Card.Root class="mb-6">
        <Card.Header class="pb-3">
          <Card.Title class="text-sm">Webhook URL</Card.Title>
          <Card.Description class="text-xs">
            Register this URL in your {meta.label} developer settings.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <div
            class="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2.5"
          >
            <code
              class="min-w-0 flex-1 truncate font-mono text-xs text-foreground/80"
            >
              {webhookUrl}
            </code>
            <CopyButton text={webhookUrl} label="Copy webhook URL" />
          </div>
        </Card.Content>
      </Card.Root>
    {/if}

    {#if meta.envVariables.length > 0}
      <Card.Root>
        <Card.Header class="pb-3">
          <Card.Title class="text-sm">Environment Variables</Card.Title>
          <Card.Description class="text-xs">
            Add these to your <code class="font-mono">.env</code> file. Secrets
            are never shown here.
          </Card.Description>
        </Card.Header>
        <Card.Content class="p-0">
          <div class="divide-y divide-border/60">
            {#each meta.envVariables as variable (variable.key)}
              <div
                class={cn(
                  "flex items-start gap-3 px-5 py-3.5",
                  missingSet.has(variable.key) && "bg-amber-500/5",
                )}
              >
                <div class="min-w-0 flex-1 space-y-0.5">
                  <div class="flex items-center gap-2">
                    <code class="font-mono text-xs text-foreground/90"
                      >{variable.key}</code
                    >
                    {#if !variable.required}
                      <span class="text-[10px] text-muted-foreground/60"
                        >optional</span
                      >
                    {/if}
                  </div>
                  <p class="text-xs text-muted-foreground">
                    {variable.description}
                  </p>
                </div>

                <div class="flex shrink-0 items-center gap-2 pt-0.5">
                  {#if !statusQuery.isPending && statusQuery.data && variable.required}
                    {#if missingSet.has(variable.key)}
                      <Badge
                        variant="outline"
                        class="h-5 gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-400"
                      >
                        <AlertTriangle size={9} />
                        Missing
                      </Badge>
                    {:else}
                      <Badge
                        variant="outline"
                        class="h-5 gap-1 border-emerald-500/40 bg-emerald-500/10 px-1.5 text-[10px] text-emerald-400"
                      >
                        <CheckCircle2 size={9} />
                        Set
                      </Badge>
                    {/if}
                  {/if}

                  <Button
                    href={variable.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="ghost"
                    size="icon-sm"
                    class="h-6 w-6 text-muted-foreground hover:text-foreground"
                    title="View docs"
                  >
                    <ExternalLink size={12} />
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
{/if}
