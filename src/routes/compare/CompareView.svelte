<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { navigating } from "$app/state";
  import { IconArrowLeft, IconArrowsShuffle } from "@tabler/icons-svelte";
  import AutocompleteCompact from "$lib/components/AutocompleteCompact.svelte";
  import Rating from "$lib/components/Rating.svelte";
  import CompareCard from "./CompareCard.svelte";
  import { createCompareView } from "./compareView.svelte.js";

  type Props = {
    pairA: ImageWithId | null;
    pairB: ImageWithId | null;
    total: number;
  };

  let { pairA, pairB, total }: Props = $props();

  const ui = createCompareView();
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<header class="page-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>
  <span class="page-header-title">比較</span>
  <div class="compare-header-filter">
    <AutocompleteCompact bind:tags={ui.filterTags} placeholder="標籤篩選..." onchange={ui.handleFilterChange} />
    <Rating bind:value={ui.filterMinRating} size="1rem" onchange={ui.handleFilterChange} />
    <span class="compare-count">{total} 張</span>
  </div>
</header>

<main class="compare-main">
  {#if navigating.to}
    <div class="compare-empty">載入中…</div>
  {:else if !pairA || !pairB}
    <div class="compare-empty">篩選條件下的圖片不足兩張</div>
  {:else}
    <CompareCard image={pairA} onclick={() => ui.handleCardClick(pairA.id)} />
    <CompareCard image={pairB} onclick={() => ui.handleCardClick(pairB.id)} />
  {/if}
</main>

<footer class="compare-footer">
  <button class="btn btn-primary" onclick={ui.handleShuffleClick} disabled={!!navigating.to}>
    <IconArrowsShuffle size={18} />
    換一組 <span class="kbd">Space</span>
  </button>
</footer>

<style>
  .compare-header-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .compare-count {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-dim);
    white-space: nowrap;
    margin-left: auto;
  }

  .compare-main {
    display: flex;
    gap: 1rem 0.5rem;
    padding: 1rem;
    flex: 1;
    min-height: 0;
  }

  .compare-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
    font-size: 0.875rem;
  }

  .compare-footer {
    display: grid;
    place-items: center;
    height: 3rem;
    background: var(--bg-card);
    border-top: 1px solid var(--border);
  }

  /* 換一組按鈕在 loading 時保持原本外觀，避免 opacity 閃爍 */
  .compare-footer :global(.btn:disabled) {
    opacity: 1;
    cursor: pointer;
  }
</style>
