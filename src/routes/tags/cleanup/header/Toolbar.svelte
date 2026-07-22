<script lang="ts">
  import RefreshButton from "$lib/components/widgets/RefreshButton.svelte";
  import ReviewTrigger from "$lib/components/review/ReviewTrigger.svelte";
  import Filters from "./Filters.svelte";

  import { getOperationsContext } from "../logic/operations.svelte";
  import { getScheduleContext } from "../logic/schedule.svelte";
  import { getReviewContext } from "../logic/review.svelte";

  const operations = getOperationsContext();
  const schedule = getScheduleContext();
  const review = getReviewContext();
</script>

<div class="container">
  <Filters />

  <div>
    <RefreshButton pending={operations.pending} onrefresh={operations.handleRefresh} />

    <ReviewTrigger
      count={schedule.touchedCount}
      disabled={schedule.touchedCount === 0 || operations.pending}
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
    overflow-x: auto;
  }

  div.container > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
