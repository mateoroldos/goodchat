<script lang="ts">
  import { Check, Copy } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";

  interface Props {
    class?: string;
    label?: string;
    text: string;
  }

  const { text, label, class: className }: Props = $props();

  let copied = $state(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 2000);
  };
</script>

<Button
  variant="ghost"
  size="icon-sm"
  class={cn(
    "h-6 w-6 shrink-0",
    copied
      ? "text-green-500 hover:text-green-500"
      : "text-muted-foreground hover:text-foreground",
    className
  )}
  onclick={copy}
  aria-label={label ?? "Copy to clipboard"}
>
  {#if copied}
    <Check size={12} />
  {:else}
    <Copy size={12} />
  {/if}
</Button>
