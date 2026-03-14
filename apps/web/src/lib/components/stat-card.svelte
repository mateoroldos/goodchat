<script lang="ts">
  import type { ComponentType, SvelteComponent } from "svelte";
  import * as Card from "$lib/components/ui/card";

  interface Props {
    description?: string;
    icon: ComponentType<
      SvelteComponent<{ size?: number | string; class?: string }>
    >;
    label: string;
    value: number | string;
  }

  const { label, value, icon: Icon, description }: Props = $props();
</script>

<Card.Root class="transition-colors hover:bg-card/80">
  <Card.Content class="p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium text-muted-foreground">{label}</p>
      <div class="rounded-md bg-primary/10 p-2 text-primary">
        <Icon size={16} />
      </div>
    </div>
    <div class="mt-3">
      <p class="text-2xl font-bold tracking-tight">{value}</p>
      {#if description}
        <p class="mt-0.5 text-xs text-muted-foreground">{description}</p>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
