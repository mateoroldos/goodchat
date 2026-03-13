<script lang="ts">
  import { getThreads } from "$lib/threads";

  let threads = $state(getThreads());

  const reload = () => {
    threads = getThreads();
  };
</script>

<div class="container mx-auto max-w-3xl px-4 py-2">
  <div class="grid gap-6">
    <div class="rounded-xl border border-slate-200 bg-white/70 p-5 shadow-sm">
      <div
        class="mb-4 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500"
      >
        <span>Recent Threads</span>
      </div>

      <div class="space-y-4">
        <svelte:boundary>
          {#snippet pending()}
            <p>loading...</p>
          {/snippet}

          {#snippet failed(_e)}
            oops! there was an error loading threads.
            <button onclick={reload} type="button">try again</button>
          {/snippet}

          {#await threads}
            <p>loading...</p>
          {:then entries}
            {#each entries as entry (entry.id)}
              <article
                class="rounded-lg border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div
                  class="flex flex-wrap items-center gap-2 text-xs text-slate-500"
                >
                  <span class="font-semibold text-slate-700"
                    >{entry.botName}</span
                  >
                  <span class="rounded-full bg-slate-100 px-2 py-0.5"
                    >{entry.platform}</span
                  >
                  <span>user {entry.userId}</span>
                </div>
                <div class="mt-3 grid gap-3 text-sm text-slate-700">
                  <div>
                    <p
                      class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                      Message
                    </p>
                    <p class="mt-1 whitespace-pre-line">{entry.text}</p>
                  </div>
                  <div
                    class="rounded-md border border-slate-100 bg-slate-50 p-3"
                  >
                    <p
                      class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                      Response
                    </p>
                    <p class="mt-1 whitespace-pre-line text-slate-600">
                      {entry.responseText}
                    </p>
                  </div>
                </div>
              </article>
            {:else}
              <p>No threads!</p>
            {/each}
          {:catch _e}
            oops! there was an error loading threads.
            <button onclick={reload} type="button">try again</button>
          {/await}
        </svelte:boundary>
      </div>
    </div>
  </div>
</div>
