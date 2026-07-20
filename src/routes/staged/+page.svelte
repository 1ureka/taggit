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

  import Toolbar from "./header/Toolbar.svelte";
  import ImportModal from "./header/ImportModal.svelte";
  import Cards from "./cards/Cards.svelte";
  import Inspector from "./inspector/Inspector.svelte";
  import Lightbox from "./inspector/Lightbox.svelte";
  import ReviewModal from "./review/ReviewModal.svelte";

  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  createPageDataContext(() => data);
  createOperationsContext();
  const editor = createEditorContext();
  createStampContext();
  createLightboxContext();
  createReviewContext();
  createImportContext();

  beforeNavigate(editor.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={editor.handleBeforeUnload} />

<svelte:head>
  <title>Staged</title>
</svelte:head>

<div class="page">
  <Toolbar />
  <div>
    <Cards />
    <Inspector />
  </div>
</div>

<ReviewModal />
<ImportModal />
<Lightbox />

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
