<script lang="ts">
  import { navigating } from "$app/state";
  import type { ImageWithId } from "$lib/types.js";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { createScrollMasonry } from "./scrollMasonry.svelte.js";

  type Props = {
    items: ImageWithId[];
    columns: number;
    pageContentEl: HTMLElement | null;
  };

  let { items, columns = $bindable(), pageContentEl }: Props = $props();

  const ui = createScrollMasonry({
    get items() {
      return items;
    },
    get columns() {
      return columns;
    },
    set columns(v) {
      columns = v;
    },
    get pageContentEl() {
      return pageContentEl;
    },
  });
</script>

{#if items.length === 0 && !navigating.to}
  <div class="scroll-empty">找不到符合的圖片</div>
{/if}

<div
  class="masonry-container"
  bind:this={ui.containerEl}
  style:height="{ui.totalHeight}px"
  style:opacity={navigating.to ? 0.4 : 1}
>
  {#each ui.visibleItems as item (item.id)}
    <div
      class="masonry-item"
      style:transform="translate3d({item.pixelX}px, {item.pixelY}px, 0)"
      style:width="{item.pixelW}px"
      style:height="{item.pixelH}px"
    >
      <img
        class="masonry-img"
        src={imgSrc("committed", `${item.id}${item.ext}`, "md")}
        style={blurhashStyle({ fit: "cover", blurhash: item.blurhash, width: item.width, height: item.height })}
        alt={item.name || item.id}
        loading="lazy"
        draggable="false"
        ondblclick={() => ui.handleImageDblClick(item)}
      />
    </div>
  {/each}
</div>

<style>
  .masonry-container {
    position: relative;
    margin-top: 0.75rem;
    overflow-x: hidden;
    transition: opacity 0s step-end 0.2s;
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
  }

  .scroll-empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 3rem 1rem;
  }
</style>
