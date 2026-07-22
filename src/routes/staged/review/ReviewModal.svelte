<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import ReviewHeader from "$lib/components/widgets/ReviewHeader.svelte";
  import ReviewList from "$lib/components/widgets/ReviewList.svelte";
  import ReviewItemImage from "$lib/components/widgets/ReviewItemImage.svelte";
  import ReviewTagImpact from "$lib/components/widgets/ReviewTagImpact.svelte";
  import ReviewFooter from "$lib/components/widgets/ReviewFooter.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";
  import { getLightboxContext } from "../logic/lightbox.svelte";

  const review = getReviewContext();
  const operations = getOperationsContext();
  const lightbox = getLightboxContext();

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal
  open={review.open}
  onclose={review.handleClose}
  aria-label="檢視待提交的變更"
  containerProps={{ style: containerStyle }}
>
  <ReviewHeader />

  <ReviewList
    pending={operations.pending}
    checkedAll={review.bulkSelectionState}
    checkableCount={review.checkableCount}
    totalCount={review.entries.length}
    checkedCount={review.checkedCount}
    ontoggleall={review.handleToggleAll}
  >
    {#each review.entries as entry (entry.filename)}
      <ReviewItemImage
        checkable={entry.checkable}
        checked={entry.checked}
        name={entry.name}
        filename={entry.filename}
        changeRating={entry.rating ? { before: 0, after: entry.rating } : undefined}
        changeTags={{ toAdd: entry.tags }}
        problem={entry.problem}
        onclickimage={() => lightbox.handleOpen(entry.filename)}
        onclickname={() => review.handleEdit(entry.filename)}
        ontoggle={() => review.handleToggle(entry.filename)}
      />
    {/each}
  </ReviewList>

  <ReviewFooter
    pending={operations.pending}
    count={review.checkedCount}
    oncancel={review.handleClose}
    onsubmit={review.handleSubmit}
  >
    <ReviewTagImpact checkedCount={review.checkedCount} tagsToAdd={review.newTags.length} tagsToRemove={0} />
  </ReviewFooter>
</Modal>
