<script lang="ts">
  import { beforeNavigate } from "$app/navigation";
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createOperationsContext } from "./logic/operations.svelte";
  import { createEditorContext } from "./logic/editor.svelte";
  import { createStampContext } from "./logic/stamp.svelte";
  import { createLightboxContext } from "./logic/lightbox.svelte";
  import { createReviewContext } from "./logic/review.svelte";
  import { createImportContext } from "./logic/import.svelte";

  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import ReviewTrigger from "$lib/components/review/ReviewTrigger.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";
  import Lightbox from "$lib/components/widgets/Lightbox.svelte";
  import SessionProgress from "./header/SessionProgress.svelte";
  import ImportModal from "./header/ImportModal.svelte";
  import Cards from "./cards/Cards.svelte";
  import Inspector from "./inspector/Inspector.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  createPageDataContext(() => data);
  const operations = createOperationsContext();
  const editor = createEditorContext();
  const stamp = createStampContext();
  const lightbox = createLightboxContext();
  const review = createReviewContext();
  createImportContext();

  const touchedCount = $derived(editor.touchedFiles.length);

  beforeNavigate(editor.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={editor.handleBeforeUnload} onpointerup={stamp.handleWindowPointerUp} />

<svelte:head>
  <title>Staged</title>
</svelte:head>

<div class="container">
  <Toolbar>
    <SessionProgress />
    <RefreshButton pending={operations.pending} onrefresh={operations.handleRefresh} style="margin-left: auto;" />
    <ImportModal />
    <ReviewTrigger
      count={touchedCount}
      disabled={operations.pending || touchedCount === 0}
      onclick={review.handleOpen}
    />
  </Toolbar>

  <div>
    <Cards />
    <Inspector />
  </div>
</div>

<ReviewModal />

<Lightbox
  item={lightbox.image}
  total={lightbox.total}
  onclose={lightbox.handleClose}
  onnext={lightbox.handleNext}
  onprev={lightbox.handlePrev}
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
    flex: 1;
    min-height: 0;
  }
</style>
