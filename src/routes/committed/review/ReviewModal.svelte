<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import ReviewHeader from "$lib/components/review/ReviewHeader.svelte";
  import ReviewList from "$lib/components/review/ReviewList.svelte";
  import ReviewItemImage from "$lib/components/review/ReviewItemImage.svelte";
  import ReviewTagImpact from "$lib/components/review/ReviewTagImpact.svelte";
  import ReviewFooter from "$lib/components/review/ReviewFooter.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";
  import { getTagImpactContext } from "../logic/tag-impact.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";
  import { buildReviewEntry } from "../logic/review-entry";

  const review = getReviewContext();
  const submit = getSubmitContext();
  const tagImpact = getTagImpactContext();
  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();

  const entries = $derived(
    review.touchedFiles.map((f) =>
      buildReviewEntry({ filename: f, drafts, reverts, checked: review.isChecked(f), failure: submit.lastFailures[f] }),
    ),
  );

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

  <ReviewFooter
    pending={submit.pending}
    count={review.submittableCount}
    oncancel={review.handleClose}
    onsubmit={review.handleSubmit}
  >
    <ReviewTagImpact
      loading={tagImpact.fetching}
      checkedCount={review.submittableCount}
      tagsToAdd={tagImpact.newTags.length}
      tagsToRemove={tagImpact.orphanedTags.length}
    />
  </ReviewFooter>
</Modal>
