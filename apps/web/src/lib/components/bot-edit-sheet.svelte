<script lang="ts">
  import type { Bot, BotPlatform } from "$lib/api/bots/bots.types";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Sheet from "$lib/components/ui/sheet";
  import { Textarea } from "$lib/components/ui/textarea";

  interface Props {
    bot: Bot;
    open?: boolean;
  }

  const PLATFORMS: readonly BotPlatform[] = [
    "local",
    "slack",
    "discord",
    "teams",
    "gchat",
  ];
  const PLATFORM_LABELS: Record<string, string> = {
    local: "Local",
    slack: "Slack",
    discord: "Discord",
    teams: "Teams",
    gchat: "Google Chat",
  };

  let { bot, open = $bindable(false) }: Props = $props();

  let name = $state("");
  let prompt = $state("");
  let selectedPlatforms = $state<BotPlatform[]>([]);

  $effect(() => {
    if (open) {
      name = bot.name;
      prompt = bot.prompt;
      selectedPlatforms = [...bot.platforms];
    }
  });

  const handleSave = () => {
    if (!(name.trim() && prompt.trim()) || selectedPlatforms.length === 0) {
      return;
    }
    // biome-ignore lint: editing not implemented yet
    window.alert(
      "Bot editing isn't implemented yet. Update the config file instead."
    );
  };

  const togglePlatform = (p: BotPlatform) => {
    if (selectedPlatforms.includes(p)) {
      selectedPlatforms = selectedPlatforms.filter((x) => x !== p);
    } else {
      selectedPlatforms = [...selectedPlatforms, p];
    }
  };

  const isValid = $derived(
    name.trim().length > 0 &&
      prompt.trim().length > 0 &&
      selectedPlatforms.length > 0
  );
</script>

<Sheet.Root bind:open>
  <Sheet.Content class="flex flex-col gap-0 p-0">
    <Sheet.Header class="border-b border-border px-6 py-4">
      <Sheet.Title>Edit Bot</Sheet.Title>
      <Sheet.Description>
        Update the bot's name, system prompt, and platforms.
      </Sheet.Description>
    </Sheet.Header>

    <div class="flex-1 overflow-y-auto px-6 py-5">
      <div class="space-y-5">
        <!-- Name -->
        <div class="space-y-1.5">
          <label for="bot-name" class="text-sm font-medium">Name</label>
          <Input id="bot-name" bind:value={name} placeholder="My bot" />
        </div>

        <!-- Prompt -->
        <div class="space-y-1.5">
          <label for="bot-prompt" class="text-sm font-medium"
            >System Prompt</label
          >
          <Textarea
            id="bot-prompt"
            bind:value={prompt}
            placeholder="You are a helpful assistant…"
            class="min-h-[180px]"
          />
          <p class="text-xs text-muted-foreground">
            This is the instruction given to the AI to define its personality
            and behaviour.
          </p>
        </div>

        <!-- Platforms -->
        <div class="space-y-2">
          <p class="text-sm font-medium">Platforms</p>
          <div class="grid grid-cols-2 gap-2">
            {#each PLATFORMS as platform (platform)}
              {@const active = selectedPlatforms.includes(platform)}
              <button
                type="button"
                onclick={() => togglePlatform(platform)}
                class={[
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-50",
                  active
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                ]}
              >
                <div
                  class={[
                    "h-3 w-3 shrink-0 rounded-full border-2",
                    active
                      ? "border-primary bg-primary"
                      : "border-muted-foreground",
                  ]}
                ></div>
                {PLATFORM_LABELS[platform]}
              </button>
            {/each}
          </div>
          {#if selectedPlatforms.length === 0}
            <p class="text-xs text-destructive">
              Select at least one platform.
            </p>
          {/if}
        </div>
      </div>
    </div>

    <Sheet.Footer class="border-t border-border px-6 py-4">
      <Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
      <Button onclick={handleSave} disabled={!isValid}>Save changes</Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
