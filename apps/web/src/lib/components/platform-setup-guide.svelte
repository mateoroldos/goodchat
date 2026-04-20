<script lang="ts">
  import type { Platform } from "@goodchat/contracts/config/types";
  import {
    PLATFORM_METADATA,
    PLATFORM_SETUP_INSTRUCTIONS,
  } from "@goodchat/contracts/platform/platform-metadata";
  import {
    AlertTriangle,
    CheckCircle2,
    ExternalLink,
    Link2,
    ListChecks,
  } from "lucide-svelte";
  import CopyButton from "$lib/components/copy-button.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Separator } from "$lib/components/ui/separator";

  interface Props {
    platformId: Platform;
    webhookUrl: string | null;
  }

  const { platformId, webhookUrl }: Props = $props();

  const meta = $derived(PLATFORM_METADATA[platformId]);
  const guide = $derived(PLATFORM_SETUP_INSTRUCTIONS[platformId]);
  const requiredVars = $derived(
    meta.envVariables.filter((variable) => variable.required)
  );
  const optionalVars = $derived(
    meta.envVariables.filter((variable) => !variable.required)
  );
</script>

<Card.Root class="mb-6">
  <Card.Header class="pb-3">
    <Card.Title class="text-sm">Setup guide</Card.Title>
    <Card.Description class="text-xs">{guide.intro}</Card.Description>
  </Card.Header>

  <Card.Content class="space-y-4">
    <div class="flex flex-wrap gap-2">
      {#each guide.links as link (link.url)}
        <Button
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          size="sm"
          class="h-7 gap-1.5 text-xs"
        >
          <ExternalLink size={12} />
          {link.label}
        </Button>
      {/each}
    </div>

    <Separator />

    <div class="space-y-4">
      {#each guide.steps as step, index (step.title)}
        <div class="flex gap-3">
          <div
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary"
          >
            {index + 1}
          </div>
          <div class="min-w-0 flex-1 space-y-2">
            <p class="text-sm font-medium">{step.title}</p>
            <p class="text-xs leading-relaxed text-muted-foreground">
              {step.description}
            </p>

            {#if step.type === "webhook" && webhookUrl}
              <div
                class="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2"
              >
                <Link2 size={12} class="shrink-0 text-muted-foreground" />
                <code class="min-w-0 flex-1 truncate font-mono text-xs"
                  >{webhookUrl}</code
                >
                <CopyButton text={webhookUrl} label="Copy webhook URL" />
              </div>
            {/if}
          </div>
        </div>
        {#if index < guide.steps.length - 1}
          <Separator class="ml-9" />
        {/if}
      {/each}
    </div>

    <Separator />

    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <ListChecks size={13} class="text-muted-foreground" />
        <p
          class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Env var summary
        </p>
      </div>

      {#if requiredVars.length === 0 && optionalVars.length === 0}
        <p class="text-xs text-muted-foreground">
          No external environment variables are required for {meta.label}.
        </p>
      {/if}

      {#if requiredVars.length > 0}
        <div class="space-y-1.5">
          <Badge variant="outline" class="h-5 text-[10px]">Required</Badge>
          <div class="flex flex-wrap gap-1.5">
            {#each requiredVars as variable (variable.key)}
              <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                >{variable.key}</code
              >
            {/each}
          </div>
        </div>
      {/if}

      {#if optionalVars.length > 0}
        <div class="space-y-1.5">
          <Badge variant="secondary" class="h-5 text-[10px]">Optional</Badge>
          <div class="flex flex-wrap gap-1.5">
            {#each optionalVars as variable (variable.key)}
              <code class="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                >{variable.key}</code
              >
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <Separator />

    <div class="grid gap-4 md:grid-cols-2">
      <div class="space-y-2">
        <p
          class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Verification checklist
        </p>
        <ul class="space-y-1.5">
          {#each guide.checklist as item (item)}
            <li class="flex items-start gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2
                size={12}
                class="mt-0.5 shrink-0 text-emerald-500"
              />
              <span>{item}</span>
            </li>
          {/each}
        </ul>
      </div>

      <div class="space-y-2">
        <p
          class="text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          Common pitfalls
        </p>
        <ul class="space-y-1.5">
          {#each guide.pitfalls as item (item)}
            <li class="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle size={12} class="mt-0.5 shrink-0 text-amber-500" />
              <span>{item}</span>
            </li>
          {/each}
        </ul>
      </div>
    </div>
  </Card.Content>
</Card.Root>
