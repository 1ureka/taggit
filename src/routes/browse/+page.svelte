<script lang="ts">
  import type { PageData } from "./$types.js";
  import BrowseForm from "./BrowseForm.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Browse — Image Manager</title>
</svelte:head>

<main class="page">
  <BrowseForm matchCount={data.matchCount} />
</main>

<style>
  main.page {
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }
</style>
