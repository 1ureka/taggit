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

  import Lightbox from "$lib/components/widgets/Lightbox.svelte";
  import Toolbar from "./header/Toolbar.svelte";
  import Cards from "./cards/Cards.svelte";
  import Inspector from "./inspector/Inspector.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  const pageData = createPageDataContext(() => data);
  createSnapshotsContext();
  createDraftsContext();
  createRevertMarkContext();
  createSubmitContext();
  const pointers = createPointersContext();
  const guard = createGuardContext();
  createQueryContext();
  createReviewContext();
  createTagImpactContext();

  beforeNavigate(guard.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={guard.handleBeforeUnload} />

<svelte:head>
  <title>Committed</title>
</svelte:head>

<div class="page">
  <Toolbar />
  <div>
    <Cards />
    <Inspector />
  </div>
</div>

<ReviewModal />

<Lightbox
  item={pointers.lightbox}
  total={pageData.value.items.length}
  onclose={pointers.handleLightboxClose}
  onnext={pointers.handleLightboxNext}
  onprev={pointers.handleLightboxPrev}
/>

<style>
  div.page {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  div.page > div {
    display: flex;
    flex: 1;
    min-height: 0;
  }
</style>
