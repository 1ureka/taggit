<script lang="ts">
  import { IconSearch, IconRotate, IconTrashX } from "@tabler/icons-svelte";
  import SelectCheckbox from "$lib/components/SelectCheckbox.svelte";
  import { trashStore, selectionStore } from "./stores.svelte.js";
  import { handleSearchInput, goToPage, handleCardClick, toggleSelect, restoreAll, emptyTrash } from "./actions.js";
</script>

<div class="trash-search slide-up">
  <div class="trash-input-row">
    <div class="search-input-wrap">
      <span class="search-adornment">
        <IconSearch size={16} />
      </span>
      <input
        class="input search-input"
        bind:value={trashStore.searchText}
        placeholder="搜尋檔名..."
        oninput={handleSearchInput}
        autocomplete="off"
      />
    </div>
    <div class="trash-actions">
      <button class="btn btn-primary btn-sm" onclick={restoreAll} disabled={trashStore.total === 0}>
        <IconRotate size={14} />
        還原全部
      </button>
      <button class="btn btn-destructive btn-sm" onclick={emptyTrash} disabled={trashStore.total === 0}>
        <IconTrashX size={14} />
        清空
      </button>
    </div>
  </div>

  {#if trashStore.total > 0}
    <div class="trash-search-info">
      <span>{trashStore.total} 張圖片</span>
      {#if trashStore.pages > 1}
        <span class="trash-search-pager">
          第 {trashStore.page} / {trashStore.pages} 頁
        </span>
      {/if}
    </div>
  {/if}

  {#if trashStore.showLoading}
    <div class="trash-search-status">搜尋中...</div>
  {:else if trashStore.files.length === 0}
    <div class="trash-search-status">垃圾桶是空的</div>
  {:else}
    <div class="trash-search-results">
      {#each trashStore.files as filename (filename)}
        {@const selected = selectionStore.selected.has(filename)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="trash-card select-checkbox-host"
          class:trash-card-selected={selected}
          onclick={() => handleCardClick(filename)}
        >
          <img class="trash-card-thumb" src="/img/trash/{filename}" alt={filename} loading="lazy" />
          <div class="trash-card-info">
            <div class="trash-card-name">{filename}</div>
          </div>
          <SelectCheckbox checked={selected} size="sm" onchange={() => toggleSelect(filename)} />
        </div>
      {/each}
    </div>
  {/if}

  {#if trashStore.pages > 1}
    <div class="trash-pagination">
      <button class="btn btn-sm" disabled={trashStore.page <= 1} onclick={() => goToPage(trashStore.page - 1)}
        >上一頁</button
      >
      {#each Array.from({ length: Math.min(trashStore.pages, 7) }, (_, i) => {
        if (trashStore.pages <= 7) return i + 1;
        if (trashStore.page <= 4) return i + 1;
        if (trashStore.page >= trashStore.pages - 3) return trashStore.pages - 6 + i;
        return trashStore.page - 3 + i;
      }) as p}
        <button class="btn btn-sm" class:btn-primary={p === trashStore.page} onclick={() => goToPage(p)}>{p}</button>
      {/each}
      <button
        class="btn btn-sm"
        disabled={trashStore.page >= trashStore.pages}
        onclick={() => goToPage(trashStore.page + 1)}>下一頁</button
      >
    </div>
  {/if}
</div>

<style>
  .trash-search {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    padding-bottom: 5rem;
  }

  .trash-input-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
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

  .trash-search-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-dim);
    margin-bottom: 0.75rem;
  }

  .trash-search-pager {
    font-family: var(--font-mono);
  }

  .trash-search-status {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 2rem 0;
  }

  .trash-search-results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
  }

  .trash-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    text-align: left;
    color: inherit;
    font-family: inherit;
    width: 100%;
  }

  .trash-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .trash-card-selected {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .trash-card-selected:hover {
    border-color: var(--accent);
  }

  .trash-card-thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
  }

  .trash-card-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .trash-card-name {
    font-size: 0.8125rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trash-pagination {
    display: flex;
    justify-content: center;
    gap: 0.375rem;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }
</style>
