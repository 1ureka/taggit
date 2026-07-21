<script lang="ts">
  import { innerWidth } from "svelte/reactivity/window";
  import { Virtualizer } from "$lib/utils/virtualize.svelte";
  import { getFilterContext } from "../logic/filter.svelte";
  import { breakpoints, CARD_SIZE } from "./config";
  import Card from "./Card.svelte";

  const filter = getFilterContext();

  const availableWidth = $derived(innerWidth.current ?? 1000);
  const layout = $derived(breakpoints.find((b) => availableWidth >= b.width)!);
  const layoutItems = $derived(filter.visible.map((s) => ({ ...s, width: CARD_SIZE.width, height: CARD_SIZE.height })));

  const masonry = Virtualizer.masonry({
    get items() {
      return layoutItems;
    },
    get columns() {
      return layout.cols;
    },
    get paddingX() {
      return layout.p;
    },
    get paddingY() {
      return layout.p;
    },
    get gap() {
      return layout.g;
    },
  });
</script>

<section aria-label="標籤清理建議" bind:this={masonry.viewportEl}>
  {#if filter.visible.length === 0}
    <div class="empty">
      <p>沒有{filter.tab === "all" ? "" : "這個分類的"}建議了，標籤庫看起來很乾淨。</p>
    </div>
  {:else}
    <ul style:height="{masonry.contentHeight}px">
      {#each masonry.visibleItems as item (item.id)}
        <li style={item.style}>
          <Card suggestion={item} />
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  section:has(.empty) {
    display: flex;
  }

  .empty {
    margin: auto;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--color-text-muted);
    font: var(--font-body1);
  }

  ul {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: block;
  }
</style>
