<script lang="ts">
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { PageData } from "./$types.js";

  import { EditorDetailContext, setEditorDetailContext } from "./context.svelte.js";
  import EditorHeader from "./EditorHeader.svelte";
  import EditorPreview from "./EditorPreview.svelte";
  import EditorPanel from "./EditorPanel.svelte";

  let { data }: { data: PageData } = $props();

  const proxy = {
    get image() {
      return data.image;
    },
    set image(v) {
      data.image = v;
    },
  };

  const ctx = setEditorDetailContext(new EditorDetailContext());
  ctx.image = proxy.image;
</script>

<svelte:head>
  <title>
    {ctx.image?.originalName || ctx.image?.id || "Editor"} — Image Manager
  </title>
</svelte:head>

<div class="page">
  <EditorHeader />

  <main class="page-content">
    <EditorPreview />
    <EditorPanel />
  </main>
</div>

{#if ctx.pendingConfirm}
  <ConfirmModal
    message={ctx.pendingConfirm.message}
    onconfirm={() => {
      ctx.pendingConfirm?.resolve(true);
      ctx.pendingConfirm = null;
    }}
    oncancel={() => {
      ctx.pendingConfirm?.resolve(false);
      ctx.pendingConfirm = null;
    }}
  />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .page-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
