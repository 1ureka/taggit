<script lang="ts">
  import ReviewList from "$lib/components/review/ReviewList.svelte";
  import ReviewListHeader from "$lib/components/review/ReviewListHeader.svelte";
  import ReviewListFooter from "$lib/components/review/ReviewListFooter.svelte";
  import ReviewItemImage from "$lib/components/review/ReviewItemImage.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const review = getReviewContext();
  const submit = getSubmitContext();
  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();
  const selection = getSelectionContext();

  /** 把一個檔名目前的編輯內容與審查資訊投影成一列審查紀錄 */
  function buildEntry(filename: string, checked: boolean, failure?: string) {
    const snapshot = reverts.draftOf(filename);

    if (snapshot !== undefined) {
      const changeTags = { toDel: snapshot.tags };
      const problem = failure ? `提交失敗：${failure}` : null;

      return { filename, name: snapshot.name, changeTags, problem, checkable: true, checked };
    }

    const draft = drafts.viewOf(filename);
    const name = draft.name.trim();

    const draftProblem = drafts.problemOf(filename);
    const problem = draftProblem ?? (failure ? `提交失敗：${failure}` : null);
    const checkable = problem === null;

    const changeTags = drafts.tagDiffOf(filename);
    const { changeName, changeRating } = drafts.fieldDiffOf(filename);

    return { filename, name, changeName, changeRating, changeTags, problem, checkable, checked: checkable && checked };
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
