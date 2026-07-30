<script lang="ts">
  import ReviewList from "$lib/components/review/ReviewList.svelte";
  import ReviewListHeader from "$lib/components/review/ReviewListHeader.svelte";
  import ReviewListFooter from "$lib/components/review/ReviewListFooter.svelte";
  import ReviewItemTag from "$lib/components/review/ReviewItemTag.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";
  import { getBoardContext } from "../logic/board.svelte";
  import { getMergeCountContext } from "../logic/merge-count.svelte";

  const review = getReviewContext();
  const submit = getSubmitContext();
  const board = getBoardContext();
  const mergeCount = getMergeCountContext();

  /** 把一個標籤目前的異動與審查資訊投影成一列審查紀錄 */
  function buildEntry(name: string, checked: boolean, failure?: string) {
    const op = board.operationOf(name)!;

    const boardProblem = board.problemOf(name);
    const problem = boardProblem ?? (failure ? `送出失敗：${failure}` : null);
    const checkable = problem === null;

    // 合併後的預估張數由 merge-count 依合併區提供，畫布本身不持有查詢結果
    const target = op.kind === "rename" || op.kind === "merge" ? op.to : undefined;
    const mergedCount = op.kind === "rename" || op.kind === "merge" ? mergeCount.countOf(op.groupId) : undefined;

    return { ...op, target, mergedCount, problem, checkable, checked: checkable && checked };
  }

  const entries = $derived(review.batchNames.map((n) => buildEntry(n, review.isChecked(n), submit.lastFailures[n])));
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
      ondiscard={() => review.handleDiscard(entry.name)}
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
