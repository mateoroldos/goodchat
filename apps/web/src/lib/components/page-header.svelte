<script lang="ts">
  import type { Snippet } from "svelte";

  interface BreadcrumbItem {
    href?: string;
    label: string;
  }

  interface Props {
    actions?: Snippet;
    breadcrumbs?: BreadcrumbItem[];
    description?: string;
    title: string;
  }

  const { title, description, breadcrumbs, actions }: Props = $props();
</script>

<div class="mb-6">
  {#if breadcrumbs && breadcrumbs.length > 0}
    <nav class="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
      {#each breadcrumbs as crumb, i (crumb.label)}
        {#if i > 0}
          <span class="text-muted-foreground/40">/</span>
        {/if}
        {#if crumb.href}
          <a href={crumb.href} class="hover:text-foreground transition-colors"
            >{crumb.label}</a
          >
        {:else}
          <span class="text-foreground">{crumb.label}</span>
        {/if}
      {/each}
    </nav>
  {/if}
  <div class="flex items-center justify-between gap-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight">{title}</h1>
      {#if description}
        <p class="mt-0.5 text-sm text-muted-foreground">{description}</p>
      {/if}
    </div>
    {#if actions}
      <div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
    {/if}
  </div>
</div>
