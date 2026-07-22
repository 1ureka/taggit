<script lang="ts">
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";
  import ReviewItemTag from "$lib/components/widgets/ReviewItemTag.svelte";
  import { getReviewContext } from "../logic/review.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";

  const review = getReviewContext();
  const operations = getOperationsContext();
</script>

<div class="container">
  <ul inert={operations.pending} aria-busy={operations.pending}>
    <li>
      <Checkbox
        checked={review.bulkSelectionState === "checked"}
        indeterminate={review.bulkSelectionState === "indeterminate"}
        status={review.checkableCount === 0 ? "disabled" : "default"}
        onchange={review.handleToggleAll}
        aria-label="全選可送出的操作"
      />
      <span>全選</span>
      <span>{review.checkedCount} / {review.checkableCount} 可送出操作已選取</span>
    </li>

    {#each review.entries as entry (entry.name)}
      <ReviewItemTag
        kind={entry.kind}
        checkable={entry.checkable}
        checked={entry.checked}
        tag={entry.name}
        count={entry.count}
        problem={entry.problem}
        ontoggle={() => review.handleToggle(entry.name)}
        ondiscard={() => review.handleDiscard(entry.name)}
        {...entry.kind === "merge" || entry.kind === "rename"
          ? { target: entry.to, mergedCount: entry.mergedCount }
          : undefined}
      />
    {/each}
  </ul>

  {#if operations.pending}
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
