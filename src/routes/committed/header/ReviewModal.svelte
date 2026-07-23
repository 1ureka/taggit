<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import ReviewHeader from "$lib/components/review/ReviewHeader.svelte";
  import ReviewTagImpact from "$lib/components/review/ReviewTagImpact.svelte";
  import ReviewFooter from "$lib/components/review/ReviewFooter.svelte";
  import ReviewTrigger from "$lib/components/review/ReviewTrigger.svelte";
  import ReviewBody from "./ReviewBody.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";
  import { getTagImpactContext } from "../logic/tag-impact.svelte";

  const review = getReviewContext();
  const submit = getSubmitContext();
  const tagImpact = getTagImpactContext();

  const touchedCount = $derived(review.touchedFiles.length);

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<ReviewTrigger count={touchedCount} disabled={submit.pending || touchedCount === 0} onclick={review.handleOpen} />

<Modal
  open={review.open}
  onclose={review.handleClose}
  aria-label="檢視待提交的變更"
  containerProps={{ style: containerStyle }}
>
  <ReviewHeader />
  <ReviewBody />
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
