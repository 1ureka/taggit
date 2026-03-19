<script lang="ts">
  import { IconCheck, IconTrash, IconX } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import { TaggerForm } from "./taggerForm.svelte.js";

  type Props = {
    currentFile: string | null;
    selectedFiles: Set<string>;
    loading: boolean;
    progress: number;
  };

  let { currentFile, selectedFiles = $bindable(), loading = $bindable(), progress = $bindable() }: Props = $props();

  const ui = new TaggerForm({
    get currentFile() {
      return currentFile;
    },
    get selectedFiles() {
      return selectedFiles;
    },
    set selectedFiles(v) {
      selectedFiles = v;
    },
    get loading() {
      return loading;
    },
    set loading(v) {
      loading = v;
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

<div class="tagger-rating">
  <Rating bind:value={ui.rating} size="1.5rem" />
</div>
<div class="separator"></div>

<div class="tagger-tags" bind:this={ui.tagInputWrapEl}>
  <Autocomplete bind:tags={ui.tags} variant="top" placeholder="輸入標籤..." onenter={ui.handleTagEnter} />
</div>

<div class="separator"></div>

<div class="tagger-actions">
  <button class="btn btn-primary btn-sm" onclick={ui.handleCommitClick} disabled={ui.loading}>
    <IconCheck size={16} />
    {ui.commitLabel}
  </button>
  <button class="btn btn-destructive btn-sm" onclick={ui.handleTrashClick} disabled={ui.loading}>
    <IconTrash size={16} />
    {ui.trashLabel}
  </button>
  <button class="btn btn-ghost btn-sm" onclick={ui.handleResetClick}>
    <IconX size={16} />
    重置
  </button>
</div>

<style>
  .tagger-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .tagger-tags {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .tagger-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tagger-actions :global(.btn) {
    flex: 1;
    min-width: 0;
  }
</style>
