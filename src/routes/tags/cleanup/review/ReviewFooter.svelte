<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import { getReviewContext } from "../logic/review.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";

  const review = getReviewContext();
  const operations = getOperationsContext();
</script>

<footer>
  <Button variant="ghost" status={operations.pending ? "disabled" : undefined} onclick={review.handleClose}>取消</Button>
  <Button
    variant="primary"
    status={operations.pending ? "pending" : review.checkedCount === 0 ? "disabled" : undefined}
    onclick={review.handleSubmit}
  >
    送出 {review.checkedCount} 筆操作
  </Button>
</footer>

<style>
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.5rem 1rem 1rem;
    border-top: var(--border-style);
  }
</style>
