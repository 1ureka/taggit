<script lang="ts">
  import { IconSearch, IconRotate, IconTrashX } from "@tabler/icons-svelte";
  import { TrashForm } from "./trashForm.svelte.js";

  type Props = { total: number };
  let { total }: Props = $props();

  const ui = new TrashForm();
</script>

<div class="form">
  <div class="search-container">
    <span class="search-adornment">
      <IconSearch size={16} />
    </span>
    <input
      class="text-input search-input"
      bind:value={ui.searchText}
      placeholder="搜尋檔名..."
      oninput={ui.handleSearchInput}
      autocomplete="off"
    />
  </div>

  <div class="actions">
    <button class="btn btn-primary btn-sm" onclick={ui.handleRestoreAllClick} disabled={total === 0}>
      <IconRotate size={14} />
      還原全部
    </button>
    <button class="btn btn-destructive btn-sm" onclick={ui.handleEmptyTrashClick} disabled={total === 0}>
      <IconTrashX size={14} />
      清空
    </button>
  </div>
</div>

<style>
  .form {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .search-container {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1;
  }

  .search-adornment {
    position: absolute;
    left: 0.75rem;
    display: flex;
    align-items: center;
    color: var(--text-dim);
    pointer-events: none;
  }

  .search-input {
    padding-left: 2.375rem;
    font-size: 0.875rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
</style>
