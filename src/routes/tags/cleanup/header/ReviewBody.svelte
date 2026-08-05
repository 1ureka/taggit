<script lang="ts">
  import ReviewList from "$lib/components/review/ReviewList.svelte";
  import ReviewListHeader from "$lib/components/review/ReviewListHeader.svelte";
  import ReviewListFooter from "$lib/components/review/ReviewListFooter.svelte";
  import ReviewItemTag from "$lib/components/review/ReviewItemTag.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";
  import { getScheduleContext } from "../logic/schedule.svelte";

  const review = getReviewContext();
  const submit = getSubmitContext();
  const schedule = getScheduleContext();

  /** 把一個標籤目前的操作與審查資訊投影成一列審查紀錄 */
  function buildEntry(name: string) {
    const op = schedule.operationOf(name)!;

    const problem = review.problemOf(name);
    const checkable = problem === null;

    const merging = op.kind === "merge";
    const target = merging ? op.to : undefined;
    // 容斥：合併後張數 = 目標張數 + 併入張數 - 兩者都有的張數
    const mergedCount = merging ? op.toCount + op.count - op.both : undefined;

    return { ...op, target, mergedCount, problem, checkable, checked: checkable && review.isChecked(name) };
  }

  const entries = $derived(review.batchNames.map(buildEntry));
</script>

<ReviewList pending={submit.pending} listCount={review.batchNames.length}>
  {#snippet header()}
    <ReviewListHeader
      checkedAll={review.bulkSelectionState}
      checkableCount={review.checkableCount}
      checkedCount={review.submittableCount}
      batch={review.batch}
      batches={review.batches}
      ontoggleall={review.handleToggleAll}
    />
  {/snippet}

  {#each entries as entry (entry.name)}
    <ReviewItemTag
      kind={entry.kind}
      checkable={entry.checkable}
      checked={entry.checked}
      tag={entry.name}
      count={entry.count}
      target={entry.target}
      mergedCount={entry.mergedCount}
      problem={entry.problem}
      ontoggle={() => review.handleToggle(entry.name)}
      ondiscard={() => schedule.handleUndo(entry.name)}
    />
  {/each}

  {#snippet footer()}
    <ReviewListFooter
      batch={review.batch}
      batches={review.batches}
      onfirst={review.handleFirstBatch}
      onprev={review.handlePrevBatch}
      onnext={review.handleNextBatch}
      onlast={review.handleLastBatch}
    />
  {/snippet}
</ReviewList>
