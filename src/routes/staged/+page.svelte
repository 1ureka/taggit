<script lang="ts">
  import { beforeNavigate } from "$app/navigation";
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createDraftsContext } from "./logic/drafts.svelte";
  import { createPointersContext } from "./logic/pointers.svelte";
  import { createSubmitContext } from "./logic/submit.svelte";
  import { createDeletionContext } from "./logic/deletion.svelte";
  import { createRefreshContext } from "./logic/refresh.svelte";
  import { createImportContext } from "./logic/import.svelte";
  import { createReviewContext } from "./logic/review.svelte";
  import { createGuardContext } from "./logic/guard.svelte";
  import { createTagImpactContext } from "./logic/tag-impact.svelte";
  import { createSelectionContext } from "./logic/selection.svelte";
  import { createSelectionDraftContext } from "./logic/selection-draft.svelte";

  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";
  import Lightbox from "$lib/components/widgets/Lightbox.svelte";
  import SessionProgress from "./header/SessionProgress.svelte";
  import ImportModal from "./header/ImportModal.svelte";
  import ReviewModal from "./header/ReviewModal.svelte";
  import Panel from "./body/Panel.svelte";
  import Cards from "./body/Cards.svelte";
  import Rail from "./body/Rail.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  const pageData = createPageDataContext(() => data);
  createDraftsContext();
  const pointers = createPointersContext();
  createSubmitContext();
  createDeletionContext();
  const refresh = createRefreshContext();
  createImportContext();
  const review = createReviewContext();
  const guard = createGuardContext();
  createTagImpactContext();
  const selection = createSelectionContext();
  createSelectionDraftContext();

  beforeNavigate(guard.handleBeforeNavigate);

  /** 從大圖預覽回到該檔案的編輯面板，沿途收掉預覽、審查清單與多選模式 */
  const handleBackToEdit = (filename: string) => {
    pointers.handleLightboxClose();
    review.handleClose();
    selection.handleExit();
    pointers.handleSelect(filename);
  };
</script>

<svelte:window onbeforeunload={guard.handleBeforeUnload} />

<svelte:head>
  <title>新增圖片 · Taggit</title>
</svelte:head>

<div class="container">
  <Toolbar>
    <SessionProgress />
    <RefreshButton pending={refresh.pending} onrefresh={refresh.handleRefresh} style="margin-left: auto;" />
    <ImportModal />
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
  total={pageData.value.stagedFiles.length}
  onclose={pointers.handleLightboxClose}
  onnext={pointers.handleLightboxNext}
  onprev={pointers.handleLightboxPrev}
  onclickname={handleBackToEdit}
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
