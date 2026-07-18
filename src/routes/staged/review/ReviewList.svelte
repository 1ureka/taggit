<script lang="ts">
  import type { ReviewEntry } from "./reviewEntry";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";
  import ReviewListItem from "./ReviewListItem.svelte";

  type Props = {
    /** 可勾選的數量 */
    checkableCount: number;
    /** 已勾選的數量 */
    checkedCount: number;
    /** 所有紀錄 */
    entries: ReviewEntry[];
    /** 是否正在提交中 */
    pending: boolean;
    /** 點擊紀錄名稱事件 */
    onedit: (filename: string) => void;
    /** 點擊紀錄圖片事件 */
    onpreview: (filename: string) => void;
    /** 點擊紀錄勾選框事件 */
    ontoggle: (filename: string) => void;
    /** 點擊全選勾選框事件 */
    ontoggleall: () => void;
  };

  let { checkableCount, checkedCount, entries, pending, ontoggle, ontoggleall, onedit, onpreview }: Props = $props();

  const bulkSelectionState = $derived.by(() => {
    if (checkableCount === 0 || checkedCount === 0) return "unchecked";
    if (checkableCount === checkedCount) return "checked";
    return "indeterminate";
  });
</script>

<div class="container">
  <ul inert={pending} aria-busy={pending}>
    <li>
      <Checkbox
        checked={bulkSelectionState === "checked"}
        indeterminate={bulkSelectionState === "indeterminate"}
        status={checkableCount === 0 ? "disabled" : "default"}
        onchange={ontoggleall}
        aria-label="全選可提交的項目"
      />
      <span>全選</span>
      <span>{checkedCount} / {checkableCount} 可提交紀錄已選取</span>
    </li>

    {#each entries as entry (entry.filename)}
      <ReviewListItem {entry} {ontoggle} {onedit} {onpreview} />
    {/each}
  </ul>

  {#if pending}
    <div>
      <CircularProgress size={24} color="var(--color-text-muted)" />
    </div>
  {/if}
</div>

<style>
  .container {
    position: relative;
  }

  .container > div {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: hsl(from var(--color-bg-popover) h s l / 0.85);
    backdrop-filter: blur(1px);
  }

  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 50vh;
    overflow-y: auto;
    padding: 1rem;
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0px;
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
