<script lang="ts">
  import { IconCheck, IconTrash, IconX } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import { TaggerForm } from "./taggerForm.svelte.js";

  type Props = {
    selectedFiles: Set<string>;
    progress: number;
  };

  let { selectedFiles = $bindable(), progress = $bindable() }: Props = $props();

  const ui = new TaggerForm({
    get selectedFiles() {
      return selectedFiles;
    },
    set selectedFiles(v) {
      selectedFiles = v;
    },
    get progress() {
      return progress;
    },
    set progress(v) {
      progress = v;
    },
  });
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<div class="field-rating">
  <Rating bind:value={ui.rating} size="1.5rem" />
</div>
<div class="separator"></div>

<div class="field-tags" bind:this={ui.tagInputWrapEl}>
  <Autocomplete bind:tags={ui.tags} variant="top" placeholder="輸入標籤..." onenter={ui.handleTagEnter} />
</div>

<div class="separator"></div>

<div class="actions">
  <button class="btn-primary btn-sm" class:pending={ui.pending} onclick={ui.handleCommitClick} disabled={ui.pending}>
    <IconCheck size={16} />
    <span>提交</span>
  </button>
  <button
    class="btn-destructive btn-sm"
    class:pending={ui.pending}
    onclick={ui.handleDeleteClick}
    disabled={ui.pending}
  >
    <IconTrash size={16} />
    <span>刪除</span>
  </button>
  <button class="btn-ghost btn-sm" onclick={ui.handleResetClick}>
    <IconX size={16} />
    <span>重置</span>
  </button>
</div>

<style>
  .field-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .field-tags {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;

    & > :global(button) {
      flex: 1;
      min-width: 0;
    }
  }
</style>
