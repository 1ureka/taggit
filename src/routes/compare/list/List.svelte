<script lang="ts">
  import { getPageDataContext } from "../logic/page-data.svelte";
  import ListHeader from "./ListHeader.svelte";
  import ListItems from "./ListItems.svelte";

  const pageData = getPageDataContext();
</script>

<div>
  <ListHeader />
  {#if pageData.value.items.length === 0}
    <p class="empty">沒有符合條件的圖片</p>
  {:else}
    <ListItems />
  {/if}
</div>

<style>
  div {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    overflow: hidden;
  }

  div > p.empty {
    padding: 1.5rem 0.75rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
