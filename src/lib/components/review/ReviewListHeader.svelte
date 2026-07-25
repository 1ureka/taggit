<script lang="ts">
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";

  type Props = {
    /** 全選勾的狀態 */
    checkedAll?: "checked" | "indeterminate" | string;
    /** 可勾選的總數 */
    checkableCount: number;
    /** 勾選的總數 */
    checkedCount: number;
    /** 目前批次 1-based */
    batch?: number;
    /** 總批次數 */
    batches?: number;
    /** 全選勾的點擊事件 */
    ontoggleall: () => void;
  };

  const { checkedAll, checkableCount, checkedCount, batch, batches, ontoggleall }: Props = $props();

  const description = $derived.by(() => {
    const selected = `${checkedCount} / ${checkableCount} 可送出操作已選取`;
    if (batch === undefined || batches === undefined || batches <= 1) return selected;
    return `${selected} · 第 ${batch} 頁 · 共 ${batches} 頁`;
  });
</script>

<li>
  <Checkbox
    checked={checkedAll === "checked"}
    indeterminate={checkedAll === "indeterminate"}
    status={checkableCount === 0 ? "disabled" : "default"}
    onchange={ontoggleall}
    aria-label="全選可送出的操作"
  />
  <span>全選</span>
  <span>{description}</span>
</li>

<style>
  li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.25rem 0px;
  }

  li > span:nth-of-type(1) {
    font: var(--font-body2);
  }

  li > span:nth-of-type(2) {
    margin-left: auto;
    font: var(--font-caption);
    color: var(--color-text-muted);
  }
</style>
