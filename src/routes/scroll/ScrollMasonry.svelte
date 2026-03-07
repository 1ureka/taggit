<script lang="ts">
  import { IconArrowUp } from "@tabler/icons-svelte";
  import { fly } from "svelte/transition";
  import { getScrollContext } from "./context.svelte.js";
  import { createScrollMasonry } from "./scrollMasonry.svelte.js";

  const ctx = getScrollContext();
  const ui = createScrollMasonry();
</script>

{#if ctx.items.length === 0 && !ctx.loading}
  <div class="scroll-empty">找不到符合的圖片</div>
{/if}

<div class="masonry-container" bind:this={ui.containerEl} style:height="{ui.totalHeight}px">
  {#each ui.visibleItems as item (item.id)}
    <div
      class="masonry-item"
      style:transform="translate3d({item.pixelX}px, {item.pixelY}px, 0)"
      style:width="{item.pixelW}px"
      style:height="{item.pixelH}px"
    >
      <img
        class="masonry-img"
        src="/img/committed/{item.id}{item.ext}"
        alt={item.originalName || item.id}
        loading="lazy"
        draggable="false"
        ondblclick={() => ui.handleImageDblClick(item)}
      />
    </div>
  {/each}
</div>

{#if ctx.loading}
  <div class="scroll-loading">載入中…</div>
{/if}

{#if ui.showFab}
  <button
    class="scroll-fab"
    onclick={ui.handleFabClick}
    aria-label="回到頂部"
    transition:fly={{ y: 16, duration: 200, opacity: 0 }}
  >
    <IconArrowUp size={20} />
  </button>
{/if}

<style>
  /* ─── Masonry ───────────────────────────────────────────── */
  .masonry-container {
    position: relative;
    margin-top: 0.75rem;
    overflow-x: hidden;
  }

  .masonry-item {
    position: absolute;
    top: 0;
    left: 0;
    padding: 3px;
  }

  .masonry-img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    border-radius: 4px;
    -webkit-user-select: none;
    user-select: none;
    animation: fadeIn 0.25s cubic-bezier(0, 0, 0.2, 1) forwards;
  }

  /* ─── States ──────────────────────────────────────────── */
  .scroll-empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 3rem 1rem;
  }

  .scroll-loading {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.8125rem;
    padding: 1.5rem 0 2rem;
  }

  /* ─── FAB ─────────────────────────────────────────────── */
  .scroll-fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: var(--bg);
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    transition:
      transform 0.15s,
      box-shadow 0.15s;
  }

  .scroll-fab:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  .scroll-fab:active {
    transform: scale(0.95);
  }
</style>
