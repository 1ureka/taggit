<script lang="ts">
  import { IconArrowRight } from "$lib/icons";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import RefreshButton from "$lib/components/widgets/RefreshButton.svelte";
  import ReviewTrigger from "$lib/components/review/ReviewTrigger.svelte";
  import Filters from "./Filters.svelte";

  import { getOperationsContext } from "../logic/operations.svelte";
  import { getBoardContext } from "../logic/board.svelte";
  import { getReviewContext } from "../logic/review.svelte";

  const operations = getOperationsContext();
  const board = getBoardContext();
  const review = getReviewContext();
</script>

<div class="container">
  <Filters />

  <div>
    <RefreshButton pending={operations.pending} onrefresh={operations.handleRefresh} />

    <ButtonLink variant="outlined" href="/tags/cleanup">
      <span>清理工具</span>
      <IconArrowRight size={16} />
    </ButtonLink>

    <ReviewTrigger
      count={board.touchedCount}
      disabled={board.touchedCount === 0 || operations.pending}
      onclick={review.handleOpen}
    />
  </div>
</div>

<style>
  div.container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding: 0px 1rem;
    height: 3rem;
    border-bottom: var(--border-style);
  }

  div.container > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
