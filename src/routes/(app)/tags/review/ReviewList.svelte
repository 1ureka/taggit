<script lang="ts">
  import { IconAlertCircleFilled } from "$lib/icons";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import type { ReviewEntry } from "./reviewEntry";
  import ReviewListItem from "./ReviewListItem.svelte";
  import ReviewImpact from "./ReviewImpact.svelte";

  type Props = {
    /** 待送出的操作清單 */
    entries: ReviewEntry[];
    /** 是否正在送出 */
    pending: boolean;
    /** 點擊操作勾選框事件 */
    ontoggle: (key: string) => void;
    /** 點擊全選勾選框事件 */
    ontoggleall: () => void;
    /** 捨棄單筆操作事件 */
    ondiscard: (key: string) => void;
  };

  let { entries, pending, ontoggle, ontoggleall, ondiscard }: Props = $props();

  const entryKind = (e: ReviewEntry): "rename" | "merge" | "delete" | "visible" | "hidden" => {
    if (e.kind === "rename") return e.merge ? "merge" : "rename";
    if (e.kind === "delete") return "delete";
    return e.hidden ? "hidden" : "visible";
  };

  const checkedCount = $derived(entries.filter((e) => e.checked).length);
  const checkableCount = $derived(entries.filter((e) => e.problem === null).length);

  const bulkSelectionState = $derived.by(() => {
    if (checkableCount === 0 || checkedCount === 0) return "unchecked";
    if (checkableCount === checkedCount) return "checked";
    return "indeterminate";
  });
</script>

<ul>
  <li class="select-all">
    <Checkbox
      checked={bulkSelectionState === "checked"}
      indeterminate={bulkSelectionState === "indeterminate"}
      status={checkableCount === 0 || pending ? "disabled" : "default"}
      onchange={ontoggleall}
      aria-label="全選可送出的操作"
    />
    <span>全選</span>
    <span>{checkedCount} / {checkableCount} 可送出操作已選取</span>
  </li>

  {#each entries as entry (entry.key)}
    <ReviewListItem
      label={entry.key}
      kind={entryKind(entry)}
      checked={entry.checked}
      checkable={entry.problem === null && !pending}
      discardable={!pending}
      ontoggle={() => ontoggle(entry.key)}
      ondiscard={() => ondiscard(entry.key)}
    >
      <ReviewImpact
        kind={entryKind(entry)}
        name={entry.name}
        count={entry.count}
        mergedTo={entry.to}
        mergedCount={entry.mergedCount}
      />

      {#snippet problem()}
        {#if entry.problem}
          <span class="problem"><IconAlertCircleFilled size={13} />{entry.problem}</span>
        {/if}
      {/snippet}
    </ReviewListItem>
  {/each}
</ul>

<style>
  ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 50vh;
    overflow-y: auto;
    padding: 0.5rem 1rem;
  }

  li.select-all {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.25rem 0px;
  }

  li.select-all > span:nth-of-type(1) {
    font: var(--font-body2);
  }

  li.select-all > span:nth-of-type(2) {
    margin-left: auto;
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  .problem {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-warning);
  }
</style>
