<script lang="ts">
  import { IconSearch, IconRotate, IconTrashX } from "@tabler/icons-svelte";
  import { getTrashContext } from "./context.svelte.js";
  import { createTrashForm } from "./trashForm.svelte.js";

  const ctx = getTrashContext();
  const ui = createTrashForm();
</script>

<div class="trash-form">
  <div class="trash-input-row">
    <div class="search-input-wrap">
      <span class="search-adornment">
        <IconSearch size={16} />
      </span>
      <input
        class="input search-input"
        bind:value={ctx.searchText}
        placeholder="搜尋檔名..."
        oninput={ui.handleSearchInput}
        autocomplete="off"
      />
    </div>
    <div class="trash-actions">
      <button class="btn btn-primary btn-sm" onclick={ui.handleRestoreAllClick} disabled={ctx.total === 0}>
        <IconRotate size={14} />
        還原全部
      </button>
      <button class="btn btn-destructive btn-sm" onclick={ui.handleEmptyTrashClick} disabled={ctx.total === 0}>
        <IconTrashX size={14} />
        清空
      </button>
    </div>
  </div>
</div>

<style>
  .trash-form {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 1rem;
  }

  .trash-input-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .search-input-wrap {
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

  .trash-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }
</style>
