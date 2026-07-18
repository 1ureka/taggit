<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import Card from "./Card.svelte";

  type Props = {
    /** 目前釘選中的圖片 */
    pinnedRecords: ImageWithId[];
    /** 目前是否正有工作處理中 */
    pending: boolean;
    /** 圖片取消釘選事件 */
    onunpin: (id: string) => void;
    /** 圖片退回事件 */
    onrevert: (id: string) => void;
  };

  let { pinnedRecords, pending, onunpin, onrevert }: Props = $props();
</script>

<div class="dock">
  {#if pinnedRecords.length === 0}
    <div class="empty">
      <p>按「隨機抽選」抽 N 張並排比較，或者從左側列表釘選</p>
    </div>
  {:else}
    {#each pinnedRecords as record (record.id)}
      <Card {record} {pending} onunpin={() => onunpin(record.id)} onrevert={() => onrevert(record.id)} />
    {/each}
  {/if}
</div>

<style>
  div.dock {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem;
    padding-left: calc(16px + 0.5rem);
    overflow-x: auto;
    overflow-y: hidden;
  }

  div.dock:has(.empty) {
    align-items: center;
    justify-content: center;
  }

  div.dock > .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;

    & > p {
      font: var(--font-body1);
      color: var(--color-text-muted);
    }

    & > p:nth-of-type(2) {
      font: var(--font-caption);
    }
  }
</style>
