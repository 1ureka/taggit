<script lang="ts">
  import { blurhashStyle } from "$lib/client/blurhash.js";
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
        src="/img/committed/{item.id}{item.ext}?size=md"
        style={blurhashStyle({ fit: "cover", blurhash: item.blurhash, width: item.width, height: item.height })}
        alt={item.name || item.id}
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
</style>
