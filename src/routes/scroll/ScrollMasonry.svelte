<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { ScrollMasonry } from "./scrollMasonry.svelte.js";

  type Props = {
    items: ImageWithId[];
    columns: number;
    pageContentEl: HTMLElement | null;
  };

  let { items, columns = $bindable(), pageContentEl }: Props = $props();

  const ui = new ScrollMasonry({
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

{#if ui.showEmpty}
  <div class="empty">找不到符合的圖片</div>
{/if}

<div
  class="container"
  class:loading={ui.loading}
  bind:this={ui.containerEl}
  style:height="{ui.totalHeight}px"
>
  {#each ui.visibleItems as item (item.id)}
    <div
      class="item"
      style:transform="translate3d({item.pixelX}px, {item.pixelY}px, 0)"
      style:width="{item.pixelW}px"
      style:height="{item.pixelH}px"
    >
      <img
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
  .container {
    position: relative;
    margin-top: 0.75rem;
    overflow-x: hidden;
    transition: opacity 0s step-start;

    &.loading {
      opacity: 0.4;
      transition: opacity 0.2s step-end;
    }
  }

  .item {
    position: absolute;
    top: 0;
    left: 0;
    padding: 3px;

    & img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      border-radius: 4px;
      -webkit-user-select: none;
      user-select: none;
    }
  }

  .empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 3rem 1rem;
  }
</style>
