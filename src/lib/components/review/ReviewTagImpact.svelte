<script lang="ts">
  import { IconInfoCircleFilled } from "$lib/icons";

  type Props = {
    /** 是否正在查詢變動 */
    loading?: boolean;
    /** 目前勾選的數量 */
    checkedCount: number;
    /** 變動預估的標籤新增影響 */
    tagsToAdd: number;
    /** 變動預估的標籤消失影響 */
    tagsToRemove: number;
  };

  const { loading, checkedCount, tagsToAdd, tagsToRemove }: Props = $props();
</script>

<div>
  <IconInfoCircleFilled size={18} />

  {#if loading}
    <div class="skeleton" inert aria-hidden="true">此次變動不會產生新標籤也不會移除任何標籤。</div>
  {:else if checkedCount === 0}
    <span>尚未勾選任何項目。</span>
  {:else if tagsToAdd === 0 && tagsToRemove === 0}
    <span>此次變動不會產生新標籤也不會移除任何標籤。</span>
  {:else}
    <span>
      {#if tagsToAdd > 0 && tagsToRemove > 0}
        將新增 {tagsToAdd} 個新標籤，並有 {tagsToRemove} 個標籤不再被任何圖片使用。
      {:else if tagsToAdd > 0}
        將新增 {tagsToAdd} 個新標籤。
      {:else}
        將有 {tagsToRemove} 個標籤不再被任何圖片使用。
      {/if}
    </span>
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
  }
</style>
