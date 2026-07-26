<script lang="ts">
  import { getPageDataContext } from "../logic/page-data.svelte";
  import { Virtualizer } from "$lib/utils/virtualize.svelte";
  import PanelListItem from "./PanelListItem.svelte";

  const pageData = getPageDataContext();

  const ROW_HEIGHT = 56;

  const list = Virtualizer.list({
    get items() {
      return pageData.value.items;
    },
    get itemHeight() {
      return ROW_HEIGHT;
    },
    get paddingX() {
      return undefined;
    },
    get paddingY() {
      return undefined;
    },
    get gap() {
      return undefined;
    },
  });
</script>

<div class="container" bind:this={list.viewportEl}>
  <ul style="height: {list.contentHeight}px" aria-label="圖庫列表">
    {#each list.visibleItems as item (item.id)}
      <li style={item.style}>
        <PanelListItem {item} />
      </li>
    {/each}
  </ul>
</div>

<style>
  div.container {
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
    box-sizing: border-box;
    padding: 0.125rem 0.375rem;
  }
</style>
