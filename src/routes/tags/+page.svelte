<script lang="ts">
  import { beforeNavigate } from "$app/navigation";
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createQueryContext } from "./logic/query.svelte";
  import { createSelectionContext } from "./logic/selection.svelte";
  import { createBoardContext } from "./logic/board.svelte";
  import { createMergeCountContext } from "./logic/merge-count.svelte";
  import { createDragContext } from "./logic/drag.svelte";
  import { createPreviewsContext } from "./logic/previews.svelte";
  import { createSubmitContext } from "./logic/submit.svelte";
  import { createReviewContext } from "./logic/review.svelte";
  import { createGuardContext } from "./logic/guard.svelte";

  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";
  import ReviewTrigger from "$lib/components/review/ReviewTrigger.svelte";
  import Filters from "./header/Filters.svelte";
  import CleanLink from "./header/CleanLink.svelte";
  import Pool from "./chips/Pool.svelte";
  import Zones from "./zone/Zones.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  createPageDataContext(() => data);
  const query = createQueryContext();
  createPreviewsContext();
  createSelectionContext();
  createBoardContext();
  createMergeCountContext();
  createDragContext();
  const submit = createSubmitContext();
  const review = createReviewContext();
  const guard = createGuardContext();

  beforeNavigate(guard.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={guard.handleBeforeUnload} />

<svelte:head>
  <title>Tags</title>
</svelte:head>

<div class="container">
  <Toolbar>
    <Filters />
    <RefreshButton pending={query.refreshing} onrefresh={query.handleRefresh} style="margin-left: auto;" />
    <CleanLink />
    <ReviewTrigger
      count={review.totalCount}
      disabled={review.totalCount === 0 || submit.pending}
      onclick={review.handleOpen}
    />
  </Toolbar>

  <div>
    <Pool />
    <Zones />
  </div>
</div>

<ReviewModal />

<style>
  div.container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  div.container > div {
    flex: 1;
    min-height: 0;
    display: flex;
  }
</style>
