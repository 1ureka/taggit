<script lang="ts">
  import { IconDeviceFloppy, IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import type { ImageWithId } from "$lib/types.js";
  import { createEditorPanel } from "./editorPanel.svelte.js";
  import EditorMetadata from "./EditorMetadata.svelte";

  type Props = {
    image: ImageWithId;
    loading: boolean;
  };

  let { image, loading = $bindable() }: Props = $props();

  const ui = createEditorPanel({
    get image() {
      return image;
    },
    get loading() {
      return loading;
    },
    set loading(v) {
      loading = v;
    },
  });
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<aside class="editor-panel">
  <div class="editor-rating">
    <Rating bind:value={ui.rating} size="1.5rem" onchange={ui.handleRatingChange} />
  </div>

  <div class="separator"></div>

  <div class="editor-name">
    <label class="editor-name-label" for="editor-name-input">名稱</label>
    <input
      id="editor-name-input"
      class="text-input"
      type="text"
      value={ui.name}
      onblur={ui.handleNameBlur}
      onkeydown={ui.handleNameKeydown}
    />
    {#if ui.nameError}
      <span class="editor-name-error">{ui.nameError}</span>
    {/if}
  </div>

  <div class="separator"></div>

  <div class="editor-tags">
    <Autocomplete bind:tags={ui.tags} variant="top" placeholder="輸入標籤..." onchange={ui.handleTagChange} />
  </div>

  <div class="separator"></div>

  <div class="editor-actions">
    <button class="btn btn-primary btn-sm" onclick={ui.handleSaveClick} disabled={!ui.dirty || ui.loading}>
      <IconDeviceFloppy size={16} />
      {ui.loading ? "操作中…" : "儲存"}
    </button>
    <button class="btn btn-destructive btn-sm" onclick={ui.handleTrashClick} disabled={ui.loading}>
      <IconTrash size={16} />
      移入垃圾桶
    </button>
  </div>

  <div class="separator"></div>

  <EditorMetadata {image} />
</aside>

<style>
  .editor-panel {
    width: 300px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
  }

  .editor-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .editor-name {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .editor-name-label {
    font-size: 0.75rem;
    color: var(--text-dim);
  }

  .editor-name-error {
    font-size: 0.6875rem;
    color: var(--destructive);
  }

  .editor-tags {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .editor-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .editor-actions :global(.btn) {
    flex: 1;
    min-width: 0;
  }
</style>
