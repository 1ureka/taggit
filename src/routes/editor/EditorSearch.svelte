<script lang="ts">
  import type { ImageWithId, QueryResult } from "$lib/types.js";
  import { api } from "$lib/client/api.js";

  let {
    initialItems = [],
    onselect,
  }: {
    initialItems?: ImageWithId[];
    onselect: (id: string) => void;
  } = $props();

  let query = $state("");
  let items = $state<ImageWithId[]>([]);
  let loading = $state(false);
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  // Sync with initialItems when they change
  $effect(() => {
    if (initialItems.length > 0 && items.length === 0) {
      items = initialItems;
    }
  });

  async function doSearch(q: string) {
    loading = true;
    try {
      const res = await api.get<QueryResult>(`/api/images?limit=60&sort=committedAt&order=desc`);
      if (res.ok && res.data) {
        const all = res.data.items;
        const needle = q.trim().toLowerCase();
        items = needle
          ? all.filter(
              (img) =>
                img.id.toLowerCase().includes(needle) ||
                (img.originalName && img.originalName.toLowerCase().includes(needle)) ||
                img.tags.some((t) => t.toLowerCase().includes(needle)),
            )
          : all;
      }
    } finally {
      loading = false;
    }
  }

  function handleInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => doSearch(query), 250);
  }
</script>

<div class="editor-search slide-up">
  <div class="editor-search-box">
    <input
      class="input input-search"
      bind:value={query}
      placeholder="搜尋圖片 ID、檔名或標籤..."
      oninput={handleInput}
      autocomplete="off"
    />
  </div>

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
              {#if img.tags.length > 0}
                <span class="editor-search-card-tags">
                  {img.tags.slice(0, 4).join(", ")}{img.tags.length > 4 ? ` +${img.tags.length - 4}` : ""}
                </span>
              {/if}
            </div>
          </div>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .editor-search {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem;
  }

  .editor-search-box {
    margin-bottom: 1.25rem;
  }

  .input-search {
    font-size: 1rem;
    padding: 0.75rem 1rem;
  }

  .editor-search-status {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 2rem 0;
  }

  .editor-search-results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
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
  }

  .editor-search-card-tags {
    color: var(--text-muted);
    font-family: var(--font);
    margin-left: 0.5rem;
  }
</style>
