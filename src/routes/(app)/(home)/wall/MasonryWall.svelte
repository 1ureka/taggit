<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { Masonry } from "$lib/virtualizer/masonry.svelte";
  import ScrollButton from "./ScrollButton.svelte";
  import MasonryImage from "./MasonryImage.svelte";

  type Props = {
    /** SSR 的圖片集合結果 */
    items: ImageWithId[];
    /** 布局欄位數量 */
    columns: number;
    /** 兩側留白 */
    paddingX: number;
    /** 上下留白 */
    paddingY: number;
    /** 項目間距 */
    gap: number;
    /** 顯示空狀態 */
    empty: boolean;
    /** 點擊卡片時觸發（開啟詳情） */
    onselect: (id: string) => void;
  };

  let { items, columns, paddingX, paddingY, gap, empty, onselect }: Props = $props();

  const masonry = new Masonry({
    get items() {
      return items;
    },
    get columns() {
      return columns;
    },
    get paddingX() {
      return paddingX;
    },
    get paddingY() {
      return paddingY;
    },
    get gap() {
      return gap;
    },
  });
</script>

<section class="masonry-viewport" aria-label="篩選結果" bind:this={masonry.viewportEl}>
  {#if empty}
    <p>找不到符合的圖片，請調整篩選條件，或在上方的導航選單中前往新增圖片</p>
  {/if}

  <ul class="masonry" aria-label="圖片牆" style:height="{masonry.masonryHeight}px">
    {#each masonry.masonryItems as item (item.id)}
      <li style={item.style}>
        <MasonryImage {item} {onselect} />
      </li>
    {/each}
  </ul>

  <ScrollButton viewportEl={masonry.viewportEl} />
</section>

<style>
  section.masonry-viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;

    & > ul.masonry {
      position: relative;
      list-style: none;
    }
  }

  section.masonry-viewport > p {
    text-align: center;
    color: var(--color-text-muted);
    font: var(--font-body1);
    padding: 3rem 0px;
  }

  li {
    display: block;
  }
</style>
