<script lang="ts">
  import { beforeNavigate } from "$app/navigation";
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createSnapshotsContext } from "./logic/snapshots.svelte";
  import { createDraftsContext } from "./logic/drafts.svelte";
  import { createRevertMarkContext } from "./logic/reverts.svelte";
  import { createSubmitContext } from "./logic/submit.svelte";
  import { createPointersContext } from "./logic/pointers.svelte";
  import { createGuardContext } from "./logic/guard.svelte";
  import { createQueryContext } from "./logic/query.svelte";
  import { createReviewContext } from "./logic/review.svelte";
  import { createTagImpactContext } from "./logic/tag-impact.svelte";
  import { createSelectionContext } from "./logic/selection.svelte";
  import { createSelectionDraftContext } from "./logic/selection-draft.svelte";

  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";
  import Lightbox from "$lib/components/widgets/Lightbox.svelte";
  import QueryControls from "./header/QueryControls.svelte";
  import ReviewModal from "./header/ReviewModal.svelte";
  import Panel from "./body/Panel.svelte";
  import Cards from "./body/Cards.svelte";
  import Rail from "./body/Rail.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  const pageData = createPageDataContext(() => data);
  createSnapshotsContext();
  createDraftsContext();
  createRevertMarkContext();
  createSubmitContext();
  const pointers = createPointersContext();
  createReviewContext();
  const guard = createGuardContext();
  const query = createQueryContext();
  createTagImpactContext();
  createSelectionContext();
  createSelectionDraftContext();

  beforeNavigate(guard.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={guard.handleBeforeUnload} />

<svelte:head>
  <title>Committed</title>
</svelte:head>

<div class="container">
  <Toolbar>
    <QueryControls />
    <RefreshButton pending={query.refreshing} onrefresh={query.handleRefresh} style="margin-left: auto;" />
    <ReviewModal />
  </Toolbar>

  <div>
    <Rail />
    <Cards />
    <Panel />
  </div>
</div>

<Lightbox
  item={pointers.lightbox}
  total={pageData.value.items.length}
  onclose={pointers.handleLightboxClose}
  onnext={pointers.handleLightboxNext}
  onprev={pointers.handleLightboxPrev}
/>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  div.container > div {
    display: flex;
    flex-direction: row;
    flex: 1;
    min-height: 0;
  }
</style>
