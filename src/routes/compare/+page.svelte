<script lang="ts">
  import type { PageData } from "./$types.js";
  import CompareView from "./CompareView.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Compare — Image Manager</title>
</svelte:head>

<div class="page">
  <CompareView pairA={data.pairA} pairB={data.pairB} total={data.total} />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
</style>
