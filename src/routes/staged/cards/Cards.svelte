<script lang="ts">
  import { innerWidth } from "svelte/reactivity/window";
  import { Masonry } from "$lib/virtualizer/masonry.svelte";

  import { breakpoints, CARD_SIZE, INSPECTOR_WIDTH } from "./config";
  import { getPageDataContext } from "../logic/page-data.svelte";
  import { getEditorContext } from "../logic/editor.svelte";
  import { getStampContext } from "../logic/stamp.svelte";

  import Card from "./Card.svelte";
  import StampBadge from "./StampBadge.svelte";

  const pageData = getPageDataContext();
  const editor = getEditorContext();
  const stamp = getStampContext();

  let anchorEl = $state<HTMLDivElement>();

  const stagedFiles = $derived(pageData.value.stagedFiles);
  const activeFile = $derived(editor.activeFile);

  const availableWidth = $derived.by(() => {
    const windowWidth = innerWidth.current ?? 1000;
    const inspectorWidth = activeFile !== null ? INSPECTOR_WIDTH : 0;
    return Math.max(1, windowWidth - inspectorWidth);
  });

  const layout = $derived(breakpoints.find((b) => availableWidth >= b.width)!);
  const layoutItems = $derived(stagedFiles.map((id) => ({ id, ...CARD_SIZE })));

  const masonry = new Masonry({
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
    if (activeFile === null) return;
    masonry.scrollToItem(activeFile);
  });
</script>

<div class="container" class:strip={stamp.isActive}>
  <div class="anchor" bind:this={anchorEl}></div>
  <StampBadge reference={anchorEl} />

  <section aria-label="暫存清單" bind:this={masonry.viewportEl}>
    {#if stagedFiles.length === 0}
      <p>暫存區目前沒有圖片</p>
    {/if}

    <ul aria-label="暫存卡片牆" style:height="{masonry.masonryHeight}px">
      {#each masonry.masonryItems as item (item.id)}
        <li style={item.style}>
          <Card filename={item.id} />
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  div.container {
    position: relative;
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  div.container > div.anchor {
    position: absolute;
    top: 0.75rem;
    right: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  div.container > section {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  div.container.strip {
    --stripe-width: 2rem;
    background-image: repeating-linear-gradient(
      45deg,
      hsl(from var(--color-accent) h s l / 0.05),
      hsl(from var(--color-accent) h s l / 0.05) var(--stripe-width),
      hsl(from var(--color-accent) h s l / 0.15) var(--stripe-width),
      hsl(from var(--color-accent) h s l / 0.15) calc(var(--stripe-width) * 2)
    );
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
