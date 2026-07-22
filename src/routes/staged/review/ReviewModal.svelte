<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import ReviewFooter from "./ReviewFooter.svelte";
  import ReviewHeader from "$lib/components/widgets/ReviewHeader.svelte";
  import ReviewList from "./ReviewList.svelte";
  import { getReviewContext } from "../logic/review.svelte";

  const review = getReviewContext();

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal
  open={review.open}
  onclose={review.handleClose}
  aria-label="檢視待提交的變更"
  containerProps={{ style: containerStyle }}
>
  <ReviewHeader />

  {#if review.entries.length === 0}
    <p>目前沒有任何暫存的變更。</p>
  {:else}
    <ReviewList />
  {/if}

  <ReviewFooter />
</Modal>

<style>
  p {
    font: var(--font-body1);
    color: var(--color-text-muted);
    padding: 2.5rem 1rem;
    text-align: center;
  }
</style>
