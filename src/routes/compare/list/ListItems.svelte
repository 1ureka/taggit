<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { List } from "$lib/virtualizer/list.svelte";
  import ListItem from "./ListItem.svelte";

  type Props = {
    /** 目前的項目列表 */
    items: ImageWithId[];
    /** 已釘選的圖片 ids */
    pinnedIds: string[];
    /** 列表項切換釘選事件 */
    ontoggle: (id: string) => void;
  };

  let { items, pinnedIds, ontoggle }: Props = $props();

  const pinnedSet = $derived(new Set(pinnedIds));

  const ROW_HEIGHT = 56;

  const list = new List({
    get items() {
      return items;
    },
    get currentIndex() {
      return null;
    },
    get onClickItem() {
      return undefined;
    },
    get itemHeight() {
      return ROW_HEIGHT;
    },
  });
</script>

<div class="viewport" bind:this={list.viewportEl} onscroll={list.handleListScroll}>
  <ul style="height: {list.listHeight}px" aria-label="圖庫列表">
    {#each list.visibleItems as item (item.id)}
      <li style="top: {item.top}px; height: {item.height}px">
        <ListItem {item} pinned={pinnedSet.has(item.id)} ontoggle={() => ontoggle(item.id)} />
      </li>
    {/each}
  </ul>
</div>

<style>
  .viewport {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  ul {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  ul > li {
    position: absolute;
    left: 0;
    right: 0;
    padding: 0.125rem 0.375rem;
  }
</style>
