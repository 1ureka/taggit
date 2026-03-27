<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { ScrollMasonry } from "./scrollMasonry.svelte.js";
  import { Masonry } from "$lib/virtualizer/masonry.svelte.js";

  type Props = { items: ImageWithId[]; columns: number };
  let { items, columns = $bindable() }: Props = $props();

  const masonry = new Masonry({
    get initialItems() {
      return items;
    },
    paddingX: 24,
    paddingY: 12,
    gap: 6,
  });

  $effect(() => {
    const breakpoints = [
      { width: 1600, cols: 6 },
      { width: 1200, cols: 5 },
      { width: 900, cols: 4 },
      { width: 600, cols: 2 },
      { width: 0, cols: 1 },
    ];

    const width = window.innerWidth;
    columns = breakpoints.find((b) => width >= b.width)?.cols ?? 3;
  });

  $effect(() => {
    masonry.handleColumnChange(columns);
  });

  const ui = new ScrollMasonry({
    get items() {
      return items;
    },
  });
</script>

{#if ui.showEmpty}
  <div class="empty">找不到符合的圖片</div>
{/if}

<div class="viewport" bind:this={masonry.viewportEl}>
  <div class="masonry" class:loading={ui.loading} style:height="{masonry.masonryHeight}px">
    {#each masonry.masonryItems as item (item.id)}
      <div class="masonry-item" style={item.style}>
        <img
          src={imgSrc(item.id, "md")}
          style={blurhashStyle({ fit: "cover", blurhash: item.blurhash, width: item.width, height: item.height })}
          alt={item.name || item.id}
          loading="lazy"
          draggable="false"
          ondblclick={() => ui.handleImageDblClick(item)}
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .viewport {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  .masonry {
    position: relative;
    overflow-x: hidden;
    transition: opacity 0s step-start;

    &.loading {
      opacity: 0.4;
      transition: opacity 0.2s step-end;
    }
  }

  .masonry-item > img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    border-radius: 4px;
    -webkit-user-select: none;
    user-select: none;
  }

  .empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 3rem 1rem;
  }
</style>
