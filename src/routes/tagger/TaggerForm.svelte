<script lang="ts">
  import { IconCheck, IconTrash, IconX } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import { TaggerForm } from "./taggerForm.svelte.js";

  type Props = {
    selectedFiles: Set<string>;
    loading: boolean;
    progress: number;
  };

  let { selectedFiles = $bindable(), loading = $bindable(), progress = $bindable() }: Props = $props();

  const ui = new TaggerForm({
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

<div class="field-rating">
  <Rating bind:value={ui.rating} size="1.5rem" />
</div>
<div class="separator"></div>

<div class="field-tags" bind:this={ui.tagInputWrapEl}>
  <Autocomplete bind:tags={ui.tags} variant="top" placeholder="輸入標籤..." onenter={ui.handleTagEnter} />
</div>

<div class="separator"></div>

<div class="actions">
  <button class="btn btn-primary btn-sm" onclick={ui.handleCommitClick} disabled={ui.loading}>
    {#if !ui.loading}<IconCheck size={16} />{/if}
    {ui.commitLabel}
  </button>
  <button class="btn btn-destructive btn-sm" onclick={ui.handleDeleteClick} disabled={ui.loading}>
    {#if !ui.loading}<IconTrash size={16} />{/if}
    {ui.deleteLabel}
  </button>
  <button class="btn btn-ghost btn-sm" onclick={ui.handleResetClick}>
    <IconX size={16} />
    重置
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

    & > :global(.btn) {
      flex: 1;
      min-width: 0;
    }
  }
</style>
