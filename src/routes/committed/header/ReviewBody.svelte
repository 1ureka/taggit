<script lang="ts">
  import ReviewList from "$lib/components/review/ReviewList.svelte";
  import ReviewItemImage from "$lib/components/review/ReviewItemImage.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";

  const review = getReviewContext();
  const submit = getSubmitContext();
  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();

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

  const entries = $derived(review.touchedFiles.map((f) => buildEntry(f, review.isChecked(f), submit.lastFailures[f])));
</script>

<ReviewList
  pending={submit.pending}
  checkedAll={review.bulkSelectionState}
  checkableCount={review.checkableCount}
  totalCount={review.touchedFiles.length}
  checkedCount={review.submittableCount}
  ontoggleall={review.handleToggleAll}
>
  {#each entries as entry (entry.filename)}
    <ReviewItemImage
      {...entry}
      onclickimage={() => pointers.handleLightboxOpen(entry.filename)}
      onclickname={() => review.handleEdit(entry.filename)}
      ontoggle={() => review.handleToggle(entry.filename)}
    />
  {/each}
</ReviewList>
