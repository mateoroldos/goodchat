<script lang="ts">
  import { Chat } from "@ai-sdk/svelte";
  import { createQuery } from "@tanstack/svelte-query";
  import { DefaultChatTransport } from "ai";
  import { Bot, MessageSquare } from "lucide-svelte";
  import { botQueries } from "$lib/api/bots/bots.queries";
  import {
    Conversation,
    ConversationContent,
    ConversationEmptyState,
    ConversationScrollButton,
  } from "$lib/components/ai-elements/conversation";
  import Loader from "$lib/components/ai-elements/loader/Loader.svelte";
  import {
    Message,
    MessageContent,
    MessageResponse,
  } from "$lib/components/ai-elements/new-message";
  import type { PromptInputMessage } from "$lib/components/ai-elements/prompt-input";
  import PromptInput from "$lib/components/ai-elements/prompt-input/PromptInput.svelte";
  import PromptInputSubmit from "$lib/components/ai-elements/prompt-input/PromptInputSubmit.svelte";
  import PromptInputTextarea from "$lib/components/ai-elements/prompt-input/PromptInputTextarea.svelte";
  import PromptInputToolbar from "$lib/components/ai-elements/prompt-input/PromptInputToolbar.svelte";

  const botQuery = createQuery(() => botQueries.detail());

  const chat = new Chat({
    transport: new DefaultChatTransport({
      api: "/api/local/chat/stream",
    }),
  });

  const handleSubmit = (message: PromptInputMessage, event: SubmitEvent) => {
    event?.preventDefault();

    if (message.text?.trim()) {
      chat.sendMessage({ text: message.text });
    }
  };
</script>

<div class="shrink-0 border-b px-6 py-4">
  <div class="flex items-center gap-3">
    <div
      class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
    >
      <Bot size={16} />
    </div>
    <div>
      <h1 class="text-sm font-semibold">{botQuery.data?.name ?? "Bot"}</h1>
      <p class="text-xs text-muted-foreground">Local chat session</p>
    </div>
  </div>
</div>

<Conversation class="h-full">
  <ConversationContent>
    {#if chat.messages.length === 0}
      <ConversationEmptyState
        title="Start a conversation"
        description="Send a message to chat with your bot."
      >
        {#snippet icon()}
          <MessageSquare size={32} class="opacity-40" />
        {/snippet}
      </ConversationEmptyState>
    {:else}
      {#each chat.messages as message (message.id)}
        <Message from={message.role}>
          {#each message.parts as part, partIndex (partIndex)}
            {#if part.type === "text"}
              {#if message.role === "assistant"}
                <MessageResponse content={part.text} />
              {:else}
                <MessageContent>{part.text}</MessageContent>
              {/if}
            {:else}
              {#if message.role === "assistant"}
                <MessageResponse content="[Unsupported message part]" />
              {:else}
                <MessageContent>Unsupported message part</MessageContent>
              {/if}
            {/if}
          {/each}
        </Message>
      {/each}
    {/if}
    {#if chat.status === "submitted"}
      <Loader />
    {/if}
  </ConversationContent>
  <ConversationScrollButton />
</Conversation>

<PromptInput onSubmit={handleSubmit} class="shadow-none">
  <PromptInputTextarea placeholder="Say something..." class="pr-12" />
  <PromptInputToolbar>
    <PromptInputSubmit
      status={chat.status === "streaming" ? "streaming" : "idle"}
    />
  </PromptInputToolbar>
</PromptInput>
