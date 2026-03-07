<script lang="ts">
  import { IconArrowLeft, IconDeviceFloppy, IconTrash } from "@tabler/icons-svelte";
  import { getEditorDetailContext } from "./context.svelte.js";
  import { createEditorHeader } from "./editorHeader.svelte.js";

  const ctx = getEditorDetailContext();
  const ui = createEditorHeader();
</script>

<header class="page-header">
  <a href="/editor" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    返回搜尋
  </a>
  <span class="page-header-title">
    {ctx.image?.originalName || ctx.image?.id || ""}
  </span>
  <div class="editor-header-actions">
    <button class="btn btn-primary btn-sm" onclick={ui.handleSaveClick} disabled={!ctx.dirty || ctx.saving}>
      <IconDeviceFloppy size={16} />
      {ctx.saving ? "儲存中..." : "儲存"}
    </button>
    <button class="btn btn-destructive btn-sm" onclick={ui.handleTrashClick}>
      <IconTrash size={16} />
      移入垃圾桶
    </button>
  </div>
</header>

<style>
  .editor-header-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
    flex-shrink: 0;
  }
</style>
