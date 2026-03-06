<script lang="ts">
  import { untrack } from "svelte";
  import { IconArrowLeft, IconDeviceFloppy, IconTrash } from "@tabler/icons-svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { PageData } from "./$types.js";

  import { editStore, uiStore } from "./stores.svelte.js";
  import { initEdit, saveChanges, debouncedSave, trashImage, handleEditKeydown, resolveConfirm } from "./actions.js";
  import EditorPreview from "./EditorPreview.svelte";
  import EditorInfoPanel from "./EditorInfoPanel.svelte";

  let { data }: { data: PageData } = $props();

  untrack(() => initEdit(data.image));

  // Auto-save when dirty
  $effect(() => {
    if (editStore.dirty) {
      debouncedSave();
    }
  });

  let previewFilename = $derived(editStore.image ? editStore.image.id + editStore.image.ext : null);
  let previewSrc = $derived(previewFilename ? `/img/committed/${previewFilename}` : "");
</script>

<svelte:head>
  <title>
    {editStore.image?.originalName || editStore.image?.id || "Editor"} — Image Manager
  </title>
</svelte:head>

<svelte:window onkeydown={handleEditKeydown} />

<div class="page">
  <header class="page-header">
    <a href="/editor" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      返回搜尋
    </a>
    <span class="page-header-title">
      {editStore.image?.originalName || editStore.image?.id || ""}
    </span>
    <div class="editor-header-actions">
      <button class="btn btn-primary btn-sm" onclick={saveChanges} disabled={!editStore.dirty || editStore.saving}>
        <IconDeviceFloppy size={16} />
        {editStore.saving ? "儲存中..." : "儲存"}
      </button>
      <button class="btn btn-destructive btn-sm" onclick={trashImage}>
        <IconTrash size={16} />
        移入垃圾桶
      </button>
    </div>
  </header>

  <main class="editor-content">
    <EditorPreview currentFilename={previewFilename} {previewSrc} />
    <EditorInfoPanel />
  </main>
</div>

{#if uiStore.pendingConfirm}
  <ConfirmModal
    message={uiStore.pendingConfirm.message}
    onconfirm={() => resolveConfirm(true)}
    oncancel={() => resolveConfirm(false)}
  />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .editor-header-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
    flex-shrink: 0;
  }

  .editor-content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  @media (max-width: 768px) {
    .editor-content {
      flex-direction: column;
    }
  }
</style>
