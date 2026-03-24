<script lang="ts">
  import { IconCheck, IconTrash } from "@tabler/icons-svelte";
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

<div class="TODO-actual-form">
  <div class="field-rating">
    <Rating name="rating" bind:value={ui.rating} size="1.5rem" />
  </div>

  <div class="separator"></div>

  <div class="field-tags">
    <Autocomplete bind:tags={ui.tags} variant="top" placeholder="輸入標籤..." />
  </div>

  <div class="separator"></div>

  <div class="actions">
    <button class="btn-primary" class:pending={ui.pending} onclick={ui.handleCommitClick} disabled={ui.pending}>
      <IconCheck size={16} />
      <span>提交<kbd>Ctrl + S</kbd></span>
    </button>
    <button class="btn-destructive" class:pending={ui.pending} onclick={ui.handleDeleteClick} disabled={ui.pending}>
      <IconTrash size={16} />
      <span>刪除<kbd>Ctrl + D</kbd></span>
    </button>
  </div>
</div>

<style>
  .TODO-actual-form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 0.75rem;
  }

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
    flex-direction: column;
    gap: 0.5rem;

    & > button {
      justify-content: space-between;
      flex: 1;
      min-width: 0;
    }

    & > button > span {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }

    & > button > span > kbd {
      background: transparent;
      border: none;
      padding: 0;
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.8em;
    }
  }
</style>
