<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { IconDeviceFloppy, IconTrash } from "@tabler/icons-svelte";
  import { EditorForm } from "./editorForm.svelte.js";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";

  type Props = { image: ImageWithId; loading: boolean };
  let { image, loading = $bindable() }: Props = $props();

  const ui = new EditorForm({
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

<div class="field-rating">
  <Rating bind:value={ui.rating} size="1.5rem" onchange={ui.handleRatingChange} />
</div>

<div class="separator"></div>

<div class="field-name">
  <label class="field-name-label" for="editor-name-input">名稱</label>
  <input
    id="editor-name-input"
    class="text-input"
    type="text"
    value={ui.name}
    onblur={ui.handleNameBlur}
    onkeydown={ui.handleNameKeydown}
  />
  {#if ui.nameError}
    <span class="field-name-error">{ui.nameError}</span>
  {/if}
</div>

<div class="separator"></div>

<div class="field-tags">
  <Autocomplete bind:tags={ui.tags} variant="top" placeholder="輸入標籤..." onchange={ui.handleTagChange} />
</div>

<div class="separator"></div>

<div class="actions">
  <button class="btn btn-primary btn-sm" onclick={ui.handleSaveClick} disabled={!ui.dirty || loading}>
    <IconDeviceFloppy size={16} />
    {loading ? "操作中…" : "儲存"}
  </button>
  <button class="btn btn-destructive btn-sm" onclick={ui.handleTrashClick} disabled={loading}>
    <IconTrash size={16} />
    刪除
  </button>
</div>

<style>
  .field-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .field-name {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    & > .field-name-label {
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    & > .field-name-error {
      font-size: 0.6875rem;
      color: var(--destructive);
    }
  }

  .field-tags {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;

    & > .btn {
      flex: 1;
      min-width: 0;
    }
  }
</style>
