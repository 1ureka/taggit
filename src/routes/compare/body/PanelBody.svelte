<script lang="ts">
  import { getPageDataContext } from "../logic/page-data.svelte";
  import PanelHeader from "./PanelHeader.svelte";
  import PanelList from "./PanelList.svelte";

  const pageData = getPageDataContext();
</script>

<div>
  <PanelHeader />
  {#if pageData.value.items.length === 0}
    <p>沒有符合條件的圖片</p>
  {:else}
    <PanelList />
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

  div > p {
    padding: 1.5rem 0.75rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
