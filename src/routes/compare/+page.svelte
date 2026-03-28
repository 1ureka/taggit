<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconArrowLeft, IconArrowsShuffle } from "@tabler/icons-svelte";

  import CompareCard from "./CompareCard.svelte";

  import { CompareShuffle } from "./compareShuffle.svelte.js";

  let { data }: { data: PageData } = $props();

  const handleBack = (e: MouseEvent) => {
    e.preventDefault();
    history.back();
  };

  const shuffle = new CompareShuffle();
</script>

<svelte:head>
  <title>Compare — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={shuffle.handleWindowKeydown} />

<div class="page">
  <header class="page-header">
    <button type="button" class="btn-ghost btn-sm" onclick={handleBack}>
      <IconArrowLeft size={16} />
      <span>上一頁</span>
    </button>

    <h1 class="page-header-title">比較</h1>

    <span class="count">{data.total} 張</span>
  </header>

  <main class="defer-dim" class:pending={shuffle.pending}>
    {#if data.pairs.length < 2}
      {#if !shuffle.pending}
        <div class="empty">篩選條件下的圖片不足兩張</div>
      {/if}
    {:else}
      {#each data.pairs as image (image.id)}
        <CompareCard {image} />
      {/each}
    {/if}
  </main>

  <footer>
    <button
      type="button"
      class="btn-primary"
      class:pending={shuffle.pending}
      onclick={shuffle.handleShuffleClick}
      disabled={shuffle.pending}
    >
      <IconArrowsShuffle size={18} />
      <span>換一組</span><span class="kbd">Space</span>
    </button>
  </footer>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  /* --- */

  .count {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-dim);
    white-space: nowrap;
    margin-left: auto;
  }

  /* --- */

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

  /* --- */

  footer {
    display: grid;
    place-items: center;
    height: 3rem;
    background: var(--bg-card);
    border-top: 1px solid var(--border);
  }
</style>
