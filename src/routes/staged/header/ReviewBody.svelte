<script lang="ts">
  import ReviewList from "$lib/components/review/ReviewList.svelte";
  import ReviewListHeader from "$lib/components/review/ReviewListHeader.svelte";
  import ReviewListFooter from "$lib/components/review/ReviewListFooter.svelte";
  import ReviewItemImage from "$lib/components/review/ReviewItemImage.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const review = getReviewContext();
  const submit = getSubmitContext();
  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const selection = getSelectionContext();

  /** 把一個檔名目前的編輯內容與審查資訊投影成一列審查紀錄 */
  function buildEntry(filename: string, checked: boolean, failure?: string) {
    const view = drafts.viewOf(filename);
    const name = drafts.nameOf(filename);

    const draftProblem = drafts.problemOf(filename);
    const problem = draftProblem ?? (failure ? `提交失敗：${failure}` : null);
    const checkable = problem === null;

    // 基準沒有任何內容，因此只會有新增；名稱直接顯示生效值，不做 diff
    const changeRating = view.rating > 0 ? { before: 0, after: view.rating } : undefined;
    const changeTags = { toAdd: view.tags };

    return { filename, name, changeRating, changeTags, problem, checkable, checked: checkable && checked };
  }

  const entries = $derived(review.batchFiles.map((f) => buildEntry(f, review.isChecked(f), submit.lastFailures[f])));

  const handleBackToEdit = (filename: string) => {
    review.handleClose();
    selection.handleExit();
    pointers.handleSelect(filename);
  };
</script>

<ReviewList pending={submit.pending} listCount={review.batchFiles.length}>
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

  {#each entries as entry (entry.filename)}
    <ReviewItemImage
      {...entry}
      record={entry.filename}
      onclickimage={() => pointers.handleLightboxOpen(entry.filename)}
      onclickname={() => handleBackToEdit(entry.filename)}
      ontoggle={() => review.handleToggle(entry.filename)}
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
