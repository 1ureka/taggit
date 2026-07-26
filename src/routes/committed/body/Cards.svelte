<script lang="ts">
  import { innerWidth } from "svelte/reactivity/window";
  import { Virtualizer } from "$lib/utils/virtualize.svelte";

  import Card from "./Card.svelte";

  import { breakpoints, CARD_SIZE, PANEL_WIDTH } from "./config";
  import { getPageDataContext } from "../logic/page-data.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const pageData = getPageDataContext();
  const pointers = getPointersContext();
  const selection = getSelectionContext();

  const file = $derived(pointers.editing?.id ?? null);
  const availableWidth = $derived.by(() => {
    const open = file !== null || selection.active;
    const windowWidth = innerWidth.current ?? 1000;
    const inspectorWidth = open ? PANEL_WIDTH : 0;
    return Math.max(1, windowWidth - inspectorWidth);
  });

  const layout = $derived(breakpoints.find((b) => availableWidth >= b.width)!);
  const layoutItems = $derived(pageData.value.items.map((r) => ({ ...r, ...CARD_SIZE })));

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

  $effect(() => {
    // 目前檢視中的卡片變動時，捲動可視範圍到該卡片
    if (file === null) return;
    masonry.scrollToItem(file);
  });
</script>

<section aria-label="已提交清單" bind:this={masonry.viewportEl}>
  {#if pageData.value.items.length === 0}
    <p>沒有符合條件的圖片</p>
  {/if}

  <ul aria-label="已提交卡片牆" style:height="{masonry.contentHeight}px">
    {#each masonry.visibleItems as record (record.id)}
      <li style={record.style}>
        <Card {record} />
      </li>
    {/each}
  </ul>
</section>

<style>
  section {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
  }

  p {
    text-align: center;
    color: var(--color-text-muted);
    font: var(--font-body1);
    padding: 3rem 0;
  }

  ul {
    position: relative;
  }

  li {
    display: block;
  }
</style>
