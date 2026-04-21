<script lang="ts">
  import type { BotPlatform } from "$lib/api/bots/bots.types";
  import { Badge } from "$lib/components/ui/badge";
  import { cn } from "$lib/utils";

  interface Props {
    class?: string;
    platform: BotPlatform;
  }

  const props: Props = $props();

  const PLATFORM_STYLES: Record<BotPlatform, string> = {
    web: "bg-zinc-800 text-zinc-300 border-zinc-700",
    slack: "bg-[#611f69]/20 text-[#d9a5e8] border-[#611f69]/50",
    discord: "bg-[#5865f2]/20 text-[#8b9bff] border-[#5865f2]/50",
    teams: "bg-[#6264a7]/20 text-[#9b9ecc] border-[#6264a7]/50",
    gchat: "bg-[#00ac47]/20 text-[#4ade80] border-[#00ac47]/40",
    linear: "bg-[#f11a7b]/20 text-[#f87bb8] border-[#f11a7b]/40",
    github: "bg-zinc-700/30 text-zinc-400 border-zinc-600/50",
  };

  const PLATFORM_LABELS: Record<BotPlatform, string> = {
    web: "Web",
    slack: "Slack",
    discord: "Discord",
    teams: "Teams",
    gchat: "Google Chat",
    linear: "Linear",
    github: "GitHub",
  };

  const styles = $derived.by(
    () =>
      PLATFORM_STYLES[props.platform] ??
      "bg-muted text-muted-foreground border-border"
  );
  const label = $derived.by(
    () => PLATFORM_LABELS[props.platform] ?? props.platform
  );
</script>

<Badge class={cn(styles, props.class)} variant="outline"> {label} </Badge>
