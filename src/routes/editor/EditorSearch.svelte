<script lang="ts">
  import { IconSearch } from "@tabler/icons-svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import SelectCheckbox from "$lib/components/SelectCheckbox.svelte";
  import { searchStore, selectionStore } from "./stores.svelte.js";
  import { handleSearchInput, handleFilterChange, goToPage, handleCardClick, toggleSelect } from "./actions.js";
</script>

<div class="editor-search slide-up">
  <div class="editor-search-grid">
    <div class="search-input-wrap">
      <span class="search-adornment">
        <IconSearch size={16} />
      </span>
      <input
        class="input search-input"
        bind:value={searchStore.searchText}
        placeholder="搜尋檔名..."
        oninput={handleSearchInput}
        autocomplete="off"
      />
    </div>
    <div class="editor-filters">
      <FilterBar
        allTags={searchStore.allTags}
        bind:selectedTags={searchStore.selectedTags}
        bind:rating={searchStore.rating}
        bind:ratingOp={searchStore.ratingOp}
        bind:sort={searchStore.sort}
        bind:order={searchStore.order}
        onchange={handleFilterChange}
      />
    </div>
  </div>

  {#if searchStore.total > 0}
    <div class="editor-search-info">
      <span>{searchStore.total} 張圖片</span>
      {#if searchStore.pages > 1}
        <span class="editor-search-pager">
          第 {searchStore.page} / {searchStore.pages} 頁
        </span>
      {/if}
    </div>
  {/if}

  {#if searchStore.showLoading}
    <div class="editor-search-status">搜尋中...</div>
  {:else if searchStore.items.length === 0}
    <div class="editor-search-status">找不到符合的圖片</div>
  {:else}
    <div class="editor-search-results">
      {#each searchStore.items as img (img.id)}
        {@const selected = selectionStore.selected.has(img.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="editor-search-card select-checkbox-host"
          class:editor-search-card-selected={selected}
          onclick={() => handleCardClick(img.id)}
        >
          <img
            class="editor-search-card-thumb"
            src="/img/committed/{img.id}{img.ext}"
            alt={img.originalName || img.id}
            loading="lazy"
          />
          <div class="editor-search-card-info">
            <div class="editor-search-card-name">{img.originalName || img.id + img.ext}</div>
            <div class="editor-search-card-meta">
              {img.id}
              {#if img.rating}
                <span class="editor-search-card-rating">{"★".repeat(img.rating)}</span>
              {/if}
            </div>
            {#if img.tags.length > 0}
              <div class="editor-search-card-tags">
                {img.tags.slice(0, 4).join(", ")}{img.tags.length > 4 ? ` +${img.tags.length - 4}` : ""}
              </div>
            {/if}
          </div>
          <SelectCheckbox checked={selected} size="sm" onchange={() => toggleSelect(img.id)} />
        </div>
      {/each}
    </div>
  {/if}

  {#if searchStore.pages > 1}
    <div class="editor-pagination">
      <button class="btn btn-sm" disabled={searchStore.page <= 1} onclick={() => goToPage(searchStore.page - 1)}
        >上一頁</button
      >
      {#each Array.from({ length: Math.min(searchStore.pages, 7) }, (_, i) => {
        if (searchStore.pages <= 7) return i + 1;
        if (searchStore.page <= 4) return i + 1;
        if (searchStore.page >= searchStore.pages - 3) return searchStore.pages - 6 + i;
        return searchStore.page - 3 + i;
      }) as p}
        <button class="btn btn-sm" class:btn-primary={p === searchStore.page} onclick={() => goToPage(p)}>{p}</button>
      {/each}
      <button
        class="btn btn-sm"
        disabled={searchStore.page >= searchStore.pages}
        onclick={() => goToPage(searchStore.page + 1)}>下一頁</button
      >
    </div>
  {/if}
</div>

<style>
  .editor-search {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
    padding-bottom: 5rem;
  }

  .editor-search-grid {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 1rem;
  }

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
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

  .editor-filters {
    width: 100%;
  }

  .editor-search-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-dim);
    margin-bottom: 0.75rem;
  }

  .editor-search-pager {
    font-family: var(--font-mono);
  }

  .editor-search-status {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 2rem 0;
  }

  .editor-search-results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
  }

  .editor-search-card {
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

  .editor-search-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .editor-search-card-selected {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .editor-search-card-thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
  }

  .editor-search-card-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .editor-search-card-name {
    font-size: 0.8125rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-search-card-meta {
    font-size: 0.6875rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.125rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .editor-search-card-rating {
    color: var(--text-muted);
    font-family: var(--font);
    font-size: 0.625rem;
    letter-spacing: -0.05em;
  }

  .editor-search-card-tags {
    font-size: 0.6875rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.125rem;
  }

  .editor-pagination {
    display: flex;
    justify-content: center;
    gap: 0.375rem;
    margin-top: 1.25rem;
    flex-wrap: wrap;
  }
</style>
