<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import { getReviewContext } from "../logic/review.svelte";
  import ReviewHeader from "./ReviewHeader.svelte";
  import ReviewFooter from "./ReviewFooter.svelte";
  import ReviewList from "./ReviewList.svelte";

  const review = getReviewContext();

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal
  open={review.open}
  onclose={review.handleClose}
  aria-label="檢視待送出的標籤清理操作"
  containerProps={{ style: containerStyle }}
>
  <ReviewHeader />

  {#if review.entries.length === 0}
    <p class="empty">目前沒有任何未送出的清理操作。</p>
  {:else}
    <ReviewList />
  {/if}

  <ReviewFooter />
</Modal>

<style>
  .empty {
    font: var(--font-body1);
    color: var(--color-text-muted);
    padding: 2.5rem 1rem;
    text-align: center;
  }
</style>
