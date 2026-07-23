<script lang="ts">
  import RefreshButton from "$lib/components/widgets/RefreshButton.svelte";
  import ReviewTrigger from "$lib/components/review/ReviewTrigger.svelte";
  import Filters from "./Filters.svelte";

  import { getQueryContext } from "../logic/query.svelte";
  import { getSubmitContext } from "../logic/submit.svelte";
  import { getReviewContext } from "../logic/review.svelte";

  const query = getQueryContext();
  const submit = getSubmitContext();
  const review = getReviewContext();

  const touchedCount = $derived(review.touchedFiles.length);
</script>

<div class="container">
  <Filters />

  <div class="actions">
    <RefreshButton pending={query.refreshing} onrefresh={query.handleRefresh} />

    <ReviewTrigger count={touchedCount} disabled={submit.pending || touchedCount === 0} onclick={review.handleOpen} />
  </div>
</div>

<style>
  div.container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
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
