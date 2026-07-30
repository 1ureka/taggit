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

  import { IconArrowRight } from "$lib/icons";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";
  import QueryControls from "./header/QueryControls.svelte";
  import ReviewModal from "./header/ReviewModal.svelte";
  import Pool from "./body/Pool.svelte";
  import Panel from "./body/Panel.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  createPageDataContext(() => data);
  const query = createQueryContext();
  createPreviewsContext();
  createSelectionContext();
  createBoardContext();
  createMergeCountContext();
  createDragContext();
  createSubmitContext();
  createReviewContext();
  const guard = createGuardContext();

  beforeNavigate(guard.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={guard.handleBeforeUnload} />

<svelte:head>
  <title>Tags</title>
</svelte:head>

<div class="container">
  <Toolbar>
    <QueryControls />
    <RefreshButton pending={query.refreshing} onrefresh={query.handleRefresh} style="margin-left: auto;" />
    <ButtonLink variant="outlined" href="/tags/cleanup">
      <span>清理工具</span>
      <IconArrowRight size={16} />
    </ButtonLink>
    <ReviewModal />
  </Toolbar>

  <div>
    <Pool />
    <Panel />
  </div>
</div>

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
