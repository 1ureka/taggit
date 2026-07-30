<script lang="ts">
  import { getPageDataContext } from "../logic/page-data.svelte";
  import Chip from "./Chip.svelte";

  const pageData = getPageDataContext();
  const items = $derived(pageData.value.items);

  let scrollerEl = $state<HTMLElement>();

  $effect(() => {
    items; // 換頁/篩選後資料一到就捲回頂端
    scrollerEl?.scrollTo({ top: 0 });
  });
</script>

<div bind:this={scrollerEl}>
  {#each items as tag (tag.name)}
    <Chip {tag} />
  {:else}
    <p>沒有符合的標籤</p>
  {/each}
</div>

<style>
  div {
    position: relative;
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 0.375rem;
    padding: 0.75rem;
    min-height: 0;
    overflow-y: auto;
    background-color: var(--color-bg);
  }

  p {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font: var(--font-body2);
    color: var(--color-text-muted);
  }
</style>
