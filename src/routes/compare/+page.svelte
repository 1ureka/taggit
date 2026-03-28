<script lang="ts">
  import type { PageData } from "./$types.js";
  import { navigating } from "$app/state";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import CompareCard from "./CompareCard.svelte";
  import CompareShuffle from "./CompareShuffle.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Compare — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      <span>首頁</span>
    </a>

    <h1 class="page-header-title">比較</h1>

    <span class="count">{data.total} 張</span>
  </header>

  <main class="defer-dim" class:pending={navigating.to}>
    {#if !data.pairA || !data.pairB}
      {#if !navigating.to}
        <div class="empty">篩選條件下的圖片不足兩張</div>
      {/if}
    {:else}
      <CompareCard image={data.pairA} />
      <CompareCard image={data.pairB} />
    {/if}
  </main>

  <footer>
    <CompareShuffle />
  </footer>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .count {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-dim);
    white-space: nowrap;
    margin-left: auto;
  }

  main {
    display: flex;
    gap: 1rem 0.5rem;
    padding: 1rem;
    flex: 1;
    min-height: 0;

    & .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-dim);
      font-size: 0.875rem;
    }
  }

  footer {
    display: grid;
    place-items: center;
    height: 3rem;
    background: var(--bg-card);
    border-top: 1px solid var(--border);
  }
</style>
