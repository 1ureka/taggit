<script lang="ts">
  import type { PageData } from "./$types.js";
  import BrowseFilter from "./BrowseForm.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Browse — Image Manager</title>
</svelte:head>

<main class="page">
  <BrowseFilter matchCount={data.initialCount} />
</main>

<style>
  main.page {
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }
</style>
