<script lang="ts">
  import { innerWidth } from "svelte/reactivity/window";
  import { Masonry } from "$lib/virtualizer/masonry.svelte";

  import { breakpoints, CARD_SIZE, INSPECTOR_WIDTH } from "./config";
  import { getPageDataContext } from "../logic/page-data.svelte";
  import { getEditorContext } from "../logic/editor.svelte";
  import Card from "./Card.svelte";

  const pageData = getPageDataContext();
  const editor = getEditorContext();

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
    const viewportEl = masonry.viewportEl;
    if (viewportEl === null || activeFile === null) return;

    const columns = masonry.layout.tracks.length;
    if (columns === 0) return;

    for (const track of masonry.layout.tracks) {
      const found = track.find((t) => t.item.id === activeFile);
      if (found === undefined) continue;

      const pixelColumnWidth = (viewportEl.clientWidth - layout.p * 2) / columns;
      const pixelY = found.yStart * pixelColumnWidth + layout.p;
      const pixelH = (found.yEnd - found.yStart) * pixelColumnWidth;
      const viewTop = viewportEl.scrollTop;
      const viewBottom = viewTop + viewportEl.clientHeight;

      if (pixelY < viewTop) {
        viewportEl.scrollTo({ top: pixelY, behavior: "smooth" });
      } else if (pixelY + pixelH > viewBottom) {
        viewportEl.scrollTo({ top: pixelY + pixelH - viewportEl.clientHeight, behavior: "smooth" });
      }
      break;
    }
  });
</script>

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

<style>
  section {
    position: relative;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
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
