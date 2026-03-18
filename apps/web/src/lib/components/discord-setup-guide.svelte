<script lang="ts">
  import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Terminal,
  } from "lucide-svelte";
  import type { Bot } from "$lib/api/bots/bots.types";
  import CopyButton from "$lib/components/copy-button.svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Separator } from "$lib/components/ui/separator";

  interface Props {
    bot: Bot;
  }

  const { bot }: Props = $props();

  let expanded = $state(true);

  const webhookUrl = $derived(
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhook/${bot.id}/discord`
      : `/api/webhook/${bot.id}/discord`
  );

  const DISCORD_PORTAL_URL = "https://discord.com/developers/applications";

  const BOT_PERMISSIONS = [
    "Send Messages",
    "Send Messages in Threads",
    "Create Public Threads",
    "Read Message History",
    "Add Reactions",
    "Use Application Commands",
  ];

  const ENV_VARS = [
    {
      key: "DISCORD_APPLICATION_ID",
      hint: "From General Information → Application ID",
    },
    {
      key: "DISCORD_PUBLIC_KEY",
      hint: "From General Information → Public Key",
    },
    { key: "DISCORD_BOT_TOKEN", hint: "From Bot → Reset Token" },
  ];
</script>

<section aria-label="Discord setup guide">
  <Card.Root class="border-[#5865f2]/30 bg-[#5865f2]/5">
    <!-- Header -->
    <button
      class="flex w-full cursor-pointer items-center justify-between px-5 py-4 text-left"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
    >
      <div class="flex items-center gap-3">
        <div
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#5865f2]/20"
        >
          <!-- Discord logo mark (blurple) -->
          <svg
            role="img"
            aria-label="Discord"
            width="16"
            height="12"
            viewBox="0 0 127.14 96.36"
            fill="#8b9bff"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"
            />
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold">Discord Setup Guide</p>
          <p class="text-xs text-muted-foreground">
            Connect
            <span class="font-medium text-foreground/80">{bot.name}</span>
            to a Discord server
          </p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 text-muted-foreground">
        <span class="text-xs"> {expanded ? "Collapse" : "Expand"} </span>
        {#if expanded}
          <ChevronUp size={15} />
        {:else}
          <ChevronDown size={15} />
        {/if}
      </div>
    </button>

    {#if expanded}
      <Separator class="bg-[#5865f2]/20" />

      <Card.Content class="p-0">
        <!-- Step 1 -->
        <div class="px-5 py-5">
          <div class="flex gap-4">
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-[11px] font-bold text-white"
            >
              1
            </div>
            <div class="min-w-0 flex-1 space-y-3">
              <div>
                <p class="text-sm font-semibold">
                  Open the Discord Developer Portal
                </p>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  Create a new application (or select an existing one) for your
                  bot.
                </p>
              </div>
              <Button
                href={DISCORD_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                size="sm"
                class="h-8 gap-2 border-[#5865f2]/40 bg-[#5865f2]/10 text-[#8b9bff] hover:bg-[#5865f2]/20 hover:text-[#8b9bff]"
              >
                <ExternalLink size={13} />
                Open Discord Developer Portal
              </Button>
              <p class="text-xs text-muted-foreground">
                Once inside, click
                <span
                  class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80"
                  >New Application</span
                >
                and give it a name — we suggest
                <span
                  class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80"
                  >{bot.name}</span
                >.
              </p>
            </div>
          </div>
        </div>

        <Separator class="ml-14 bg-border/60" />

        <!-- Step 2 -->
        <div class="px-5 py-5">
          <div class="flex gap-4">
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-[11px] font-bold text-white"
            >
              2
            </div>
            <div class="min-w-0 flex-1 space-y-3">
              <div>
                <p class="text-sm font-semibold">
                  Copy your Application ID and Public Key
                </p>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  In the
                  <span class="font-medium text-foreground/80"
                    >General Information</span
                  >
                  tab, you'll find two values you need to note down.
                </p>
              </div>
              <div
                class="space-y-2 rounded-lg border border-border bg-muted/40 p-3"
              >
                <div class="flex items-start gap-3">
                  <span
                    class="mt-0.5 shrink-0 rounded bg-[#5865f2]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#8b9bff]"
                    >DISCORD_APPLICATION_ID</span
                  >
                  <p class="text-xs text-muted-foreground">
                    Copy the
                    <span class="font-medium text-foreground/70"
                      >Application ID</span
                    >
                    field from the top of the page.
                  </p>
                </div>
                <Separator class="bg-border/50" />
                <div class="flex items-start gap-3">
                  <span
                    class="mt-0.5 shrink-0 rounded bg-[#5865f2]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#8b9bff]"
                    >DISCORD_PUBLIC_KEY</span
                  >
                  <p class="text-xs text-muted-foreground">
                    Copy the
                    <span class="font-medium text-foreground/70"
                      >Public Key</span
                    >
                    field just below it.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator class="ml-14 bg-border/60" />

        <!-- Step 3 -->
        <div class="px-5 py-5">
          <div class="flex gap-4">
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-[11px] font-bold text-white"
            >
              3
            </div>
            <div class="min-w-0 flex-1 space-y-3">
              <div>
                <p class="text-sm font-semibold">Get your Bot Token</p>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  Click
                  <span class="font-medium text-foreground/80">Bot</span>
                  in the left sidebar, then follow these steps.
                </p>
              </div>
              <ol class="space-y-2.5 text-sm text-muted-foreground">
                <li class="flex items-start gap-2.5">
                  <span
                    class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border text-[10px] text-foreground/60"
                    >a</span
                  >
                  <span>
                    Click the
                    <span
                      class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80"
                      >Reset Token</span
                    >
                    button. Confirm with your Discord password if prompted.
                  </span>
                </li>
                <li class="flex items-start gap-2.5">
                  <span
                    class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border text-[10px] text-foreground/60"
                    >b</span
                  >
                  <span>
                    Copy the token that appears — this is your
                    <span
                      class="rounded bg-[#5865f2]/20 px-1 py-0.5 font-mono text-[10px] text-[#8b9bff]"
                      >DISCORD_BOT_TOKEN</span
                    >.
                  </span>
                </li>
                <li class="flex items-start gap-2.5">
                  <span
                    class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border text-[10px] text-foreground/60"
                    >c</span
                  >
                  <span>
                    Scroll down to
                    <span class="font-medium text-foreground/80"
                      >Privileged Gateway Intents</span
                    >
                    and enable the
                    <span
                      class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80"
                      >Message Content Intent</span
                    >
                    toggle.
                  </span>
                </li>
              </ol>
              <!-- Warning note -->
              <div
                class="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
              >
                <AlertTriangle
                  size={13}
                  class="mt-0.5 shrink-0 text-amber-500"
                />
                <p class="text-xs text-amber-600 dark:text-amber-400">
                  Discord only shows the token once. Copy it immediately and
                  store it somewhere safe before leaving the page.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator class="ml-14 bg-border/60" />

        <!-- Step 4 -->
        <div class="px-5 py-5">
          <div class="flex gap-4">
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-[11px] font-bold text-white"
            >
              4
            </div>
            <div class="min-w-0 flex-1 space-y-3">
              <div>
                <p class="text-sm font-semibold">
                  Register the Interactions Endpoint URL
                </p>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  Back in
                  <span class="font-medium text-foreground/80"
                    >General Information</span
                  >, scroll to
                  <span class="font-medium text-foreground/80"
                    >Interactions Endpoint URL</span
                  >
                  and paste the URL below, then click
                  <span
                    class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80"
                    >Save Changes</span
                  >.
                </p>
              </div>
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
              <p class="text-xs text-muted-foreground">
                Discord will send a verification request to this URL
                immediately. Make sure your server is running before saving.
              </p>
            </div>
          </div>
        </div>

        <Separator class="ml-14 bg-border/60" />

        <!-- Step 5 -->
        <div class="px-5 py-5">
          <div class="flex gap-4">
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-[11px] font-bold text-white"
            >
              5
            </div>
            <div class="min-w-0 flex-1 space-y-3">
              <div>
                <p class="text-sm font-semibold">
                  Invite the Bot to Your Server
                </p>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  Go to
                  <span class="font-medium text-foreground/80"
                    >OAuth2 → URL Generator</span
                  >
                  in the left sidebar.
                </p>
              </div>
              <div class="space-y-3 text-sm text-muted-foreground">
                <div class="space-y-1.5">
                  <p
                    class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
                  >
                    1. Select these Scopes
                  </p>
                  <div class="flex flex-wrap gap-1.5">
                    {#each ["bot", "applications.commands"] as scope (scope)}
                      <span
                        class="rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground/80"
                        >{scope}</span
                      >
                    {/each}
                  </div>
                </div>
                <div class="space-y-1.5">
                  <p
                    class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
                  >
                    2. Enable these Bot Permissions
                  </p>
                  <ul class="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {#each BOT_PERMISSIONS as permission (permission)}
                      <li class="flex items-center gap-1.5 text-xs">
                        <Check size={11} class="shrink-0 text-[#8b9bff]" />
                        {permission}
                      </li>
                    {/each}
                  </ul>
                </div>
                <div class="space-y-1.5">
                  <p
                    class="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
                  >
                    3. Copy and open the generated URL
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Scroll to the bottom of the URL Generator page, copy the
                    generated invite URL, open it in your browser, select your
                    server, and click
                    <span
                      class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80"
                      >Authorize</span
                    >.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator class="bg-[#5865f2]/20" />

        <!-- Env vars summary -->
        <div class="px-5 py-5">
          <div class="flex gap-4">
            <div
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
            >
              <Terminal size={13} />
            </div>
            <div class="min-w-0 flex-1 space-y-3">
              <div>
                <p class="text-sm font-semibold">Set Environment Variables</p>
                <p class="mt-0.5 text-sm text-muted-foreground">
                  Add these three variables to your server's
                  <span
                    class="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground/80"
                    >.env</span
                  >
                  file using the values you collected above.
                </p>
              </div>
              <div
                class="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-muted/30"
              >
                {#each ENV_VARS as envVar (envVar.key)}
                  <div
                    class="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div class="min-w-0 flex-1">
                      <p class="font-mono text-xs text-foreground/90">
                        {envVar.key}=
                      </p>
                      <p class="mt-0.5 text-[11px] text-muted-foreground/70">
                        {envVar.hint}
                      </p>
                    </div>
                    <CopyButton
                      text={`${envVar.key}=`}
                      label={`Copy ${envVar.key}`}
                    />
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </Card.Content>
    {/if}
  </Card.Root>
</section>
