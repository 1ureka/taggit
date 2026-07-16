<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import ListHeader from "./ListHeader.svelte";
  import ListItems from "./ListItems.svelte";

  type Props = {
    /** 當前篩選結果（列表項） */
    items: ImageWithId[];
    /** 篩選結果總數 */
    total: number;
    /** 已釘選的圖片 ids */
    pinnedIds: string[];
    /** 點擊列表項：切換釘選 */
    ontoggle: (id: string) => void;
  };

  let { items, total, pinnedIds, ontoggle }: Props = $props();
</script>

<div>
  <ListHeader {total} />
  {#if items.length === 0}
    <p class="empty">沒有符合條件的圖片</p>
  {:else}
    <ListItems {items} {pinnedIds} {ontoggle} />
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
