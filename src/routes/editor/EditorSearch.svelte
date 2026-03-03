<script lang="ts">
  import { IconSearch } from "@tabler/icons-svelte";
  import type { ImageWithId, TagInfo, QueryResult } from "$lib/types.js";
  import { api } from "$lib/client/api.js";
  import FilterBar from "$lib/components/FilterBar.svelte";

  let {
    initialItems = [],
    allTags = [],
    onselect,
  }: {
    initialItems?: ImageWithId[];
    allTags?: TagInfo[];
    onselect: (id: string) => void;
  } = $props();

  // ─── State ────────────────────────────────────────────────────────────
  let searchText = $state("");
  let selectedTags = $state<string[]>([]);
  let rating = $state<number | undefined>(undefined);
  let ratingOp = $state<"gte" | "lte" | "eq">("gte");
  let sort = $state("committedAt");
  let order = $state("desc");
  let items = $state<ImageWithId[]>([]);
  let total = $state(0);
  let page = $state(1);
  let pages = $state(1);
  let loading = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let initialised = $state(false);

  const PAGE_SIZE = 60;

  // Initialise from SSR data
  $effect(() => {
    if (!initialised && initialItems.length > 0) {
      items = initialItems;
      total = initialItems.length;
      initialised = true;
    }
  });

  // ─── Server query ─────────────────────────────────────────────────────
  async function doSearch(resetPage = true) {
    if (resetPage) page = 1;
    loading = true;
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("page", String(page));
      params.set("sort", sort);
      params.set("order", order);
      if (searchText.trim()) params.set("search", searchText.trim());
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
      if (rating !== undefined) {
        params.set("rating", String(rating));
        params.set("ratingOp", ratingOp);
      }

      const res = await api.get<QueryResult>(`/api/images?${params.toString()}`);
      if (res.ok && res.data) {
        items = res.data.items;
        total = res.data.total;
        pages = res.data.pages;
      }
    } finally {
      loading = false;
    }
  }

  function handleSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(), 300);
  }

  function handleFilterChange() {
    doSearch();
  }

  function goToPage(p: number) {
    if (p < 1 || p > pages) return;
    page = p;
    doSearch(false);
  }
</script>

<div class="editor-search slide-up">
  <!-- Unified search grid: search input + filter bar share the same width -->
  <div class="editor-search-grid">
    <div class="search-input-wrap">
      <span class="search-adornment">
        <IconSearch size={16} />
      </span>
      <input
        class="input search-input"
        bind:value={searchText}
        placeholder="搜尋檔名..."
        oninput={handleSearchInput}
        autocomplete="off"
      />
    </div>
    <div class="editor-filters">
      <FilterBar
        {allTags}
        bind:selectedTags
        bind:rating
        bind:ratingOp
        bind:sort
        bind:order
        onchange={handleFilterChange}
      />
    </div>
  </div>

  <!-- Results info -->
  {#if total > 0}
    <div class="editor-search-info">
      <span>{total} 張圖片</span>
      {#if pages > 1}
        <span class="editor-search-pager">
          第 {page} / {pages} 頁
        </span>
      {/if}
    </div>
  {/if}

  {#if loading}
    <div class="editor-search-status">搜尋中...</div>
  {:else if items.length === 0}
    <div class="editor-search-status">找不到符合的圖片</div>
  {:else}
    <div class="editor-search-results">
      {#each items as img (img.id)}
        <button type="button" class="editor-search-card" onclick={() => onselect(img.id)}>
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
        </button>
      {/each}
    </div>
  {/if}

  <!-- Pagination -->
  {#if pages > 1}
    <div class="editor-pagination">
      <button class="btn btn-sm" disabled={page <= 1} onclick={() => goToPage(page - 1)}>上一頁</button>
      {#each Array.from({ length: Math.min(pages, 7) }, (_, i) => {
        if (pages <= 7) return i + 1;
        if (page <= 4) return i + 1;
        if (page >= pages - 3) return pages - 6 + i;
        return page - 3 + i;
      }) as p}
        <button class="btn btn-sm" class:btn-primary={p === page} onclick={() => goToPage(p)}>{p}</button>
      {/each}
      <button class="btn btn-sm" disabled={page >= pages} onclick={() => goToPage(page + 1)}>下一頁</button>
    </div>
  {/if}
</div>

<style>
  .editor-search {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
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
