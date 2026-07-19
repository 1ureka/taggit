<script lang="ts">
  import { IconCheck } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ReviewImpact from "./ReviewImpact.svelte";
  import { getReviewContext } from "../logic/review.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";

  const review = getReviewContext();
  const operations = getOperationsContext();

  const cancelStatus = $derived(operations.pending ? "disabled" : undefined);
  const submitStatus = $derived(operations.pending ? "pending" : review.checkedCount === 0 ? "disabled" : undefined);
</script>

<footer>
  <ReviewImpact />
  <div>
    <Button variant="ghost" status={cancelStatus} onclick={review.handleClose}>取消</Button>
    <Button variant="primary" status={submitStatus} onclick={review.handleSubmit}>
      <IconCheck size={16} />
      <span>提交 {review.checkedCount} 張</span>
    </Button>
  </div>
</footer>

<style>
  footer {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    border-top: var(--border-style);
  }

  div {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
