<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import ReviewHeader from "$lib/components/review/ReviewHeader.svelte";
  import ReviewFooter from "$lib/components/review/ReviewFooter.svelte";
  import ReviewBody from "./ReviewBody.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";

  const review = getReviewContext();
  const submit = getSubmitContext();

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal
  open={review.open}
  onclose={review.handleClose}
  aria-label="檢視待送出的標籤變更"
  containerProps={{ style: containerStyle }}
>
  <ReviewHeader />
  <ReviewBody />
  <ReviewFooter
    pending={submit.pending}
    count={review.submittableCount}
    oncancel={review.handleClose}
    onsubmit={review.handleSubmit}
  />
</Modal>
