<script lang="ts">
  import "../app.css";
  import Header from "../components/header.svelte";

  const { children } = $props();
</script>

<div class="grid h-svh grid-rows-[auto_1fr]">
  <Header />
  <main class="overflow-y-auto">{@render children()}</main>
</div>
