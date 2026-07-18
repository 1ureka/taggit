<script lang="ts">
  import type { ReviewEntry } from "./reviewEntry";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";
  import ReviewListItem from "./ReviewListItem.svelte";

  type Props = {
    /** 待送出的操作清單 */
    entries: ReviewEntry[];
    /** 已勾選的數量 */
    checkedCount: number;
    /** 可勾選的數量 */
    readyCount: number;
    /** 是否正在送出 */
    pending: boolean;
    /** 點擊操作勾選框事件 */
    ontoggle: (name: string) => void;
    /** 點擊全選勾選框事件 */
    ontoggleall: () => void;
    /** 捨棄單筆操作事件 */
    ondiscard: (name: string) => void;
  };

  let { entries, checkedCount, readyCount, pending, ontoggle, ontoggleall, ondiscard }: Props = $props();

  const bulkSelectionState = $derived.by(() => {
    if (readyCount === 0 || checkedCount === 0) return "unchecked";
    if (readyCount === checkedCount) return "checked";
    return "indeterminate";
  });
</script>

<div class="container">
  <ul inert={pending} aria-busy={pending}>
    <li>
      <Checkbox
        checked={bulkSelectionState === "checked"}
        indeterminate={bulkSelectionState === "indeterminate"}
        status={readyCount === 0 ? "disabled" : "default"}
        onchange={ontoggleall}
        aria-label="全選可送出的操作"
      />
      <span>全選</span>
      <span>{checkedCount} / {readyCount} 可送出操作已選取</span>
    </li>

    {#each entries as entry (entry.name)}
      <ReviewListItem
        {entry}
        discardable={!pending}
        ontoggle={() => ontoggle(entry.name)}
        ondiscard={() => ondiscard(entry.name)}
      />
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
    padding: 0.5rem 1rem;
  }

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
