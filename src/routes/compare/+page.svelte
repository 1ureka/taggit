<script lang="ts">
  import type { ImageWithId, QueryResult } from "$lib/types.js";
  import { IconArrowLeft, IconArrowsShuffle } from "@tabler/icons-svelte";
  import { untrack } from "svelte";
  import { api } from "$lib/client/api.js";
  import AutocompleteCompact from "$lib/components/AutocompleteCompact.svelte";
  import Rating from "$lib/components/Rating.svelte";

  let { data } = $props();

  // ─── State ────────────────────────────────────────────────────────────
  let filterTags = $state<string[]>([]);
  let filterMinRating = $state(0);
  let totalCount = $state(untrack(() => data.total));
  let pairA = $state<ImageWithId | null>(untrack(() => data.pairA));
  let pairB = $state<ImageWithId | null>(untrack(() => data.pairB));
  let loading = $state(false);
  let showLoading = $state(false);
  let loadingTimer: ReturnType<typeof setTimeout> | null = null;
  let errorMsg = $state(untrack(() => (data.pairA ? "" : "圖片不足兩張")));

  const LOADING_DELAY = 200; // ms – don't flash "載入中" for fast loads

  // 初次 mount 不重新載入（SSR 已有資料），之後篩選條件變動時才重新載入
  let filterMounted = false;
  $effect(() => {
    filterTags;
    filterMinRating;
    if (!filterMounted) {
      filterMounted = true;
      return;
    }
    loadPair();
  });

  // ─── Load random pair (sort=random & limit=2) ────────────────────────
  async function loadPair() {
    loading = true;
    errorMsg = "";

    // Delay showing the loading state to prevent flicker on fast loads
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      if (loading) showLoading = true;
    }, LOADING_DELAY);

    try {
      const params = new URLSearchParams();
      params.set("sort", "random");
      params.set("limit", "2");
      if (filterTags.length > 0) params.set("tags", filterTags.join(","));
      if (filterMinRating > 0) {
        params.set("rating", String(filterMinRating));
        params.set("ratingOp", "gte");
      }

      const res = await api.get<QueryResult>(`/api/images?${params.toString()}`);
      if (!res.ok || !res.data) {
        errorMsg = res.error || "載入失敗";
        pairA = null;
        pairB = null;
        return;
      }

      const items = res.data.items;
      totalCount = res.data.total;

      if (items.length < 2) {
        errorMsg = "篩選條件下的圖片不足兩張";
        pairA = null;
        pairB = null;
        return;
      }

      pairA = items[0];
      pairB = items[1];
    } catch (e) {
      errorMsg = "載入失敗，請稍後再試";
      pairA = null;
      pairB = null;
    } finally {
      loading = false;
      if (loadingTimer) clearTimeout(loadingTimer);
      showLoading = false;
    }
  }

  function openInEditor(img: ImageWithId | null) {
    if (img) {
      window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
    }
  }

  // ─── Keyboard shortcuts ───────────────────────────────────────────────
  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
    if (e.key === " ") {
      e.preventDefault();
      loadPair();
    }
  }
</script>

<svelte:head>
  <title>Compare — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="page-compare">
  <header class="page-header">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      首頁
    </a>
    <span class="page-header-title">比較</span>
    <div class="compare-header-filter">
      <AutocompleteCompact bind:tags={filterTags} placeholder="標籤篩選..." />
      <Rating bind:value={filterMinRating} size="1rem" />
      <span class="compare-count">{totalCount} 張</span>
    </div>
  </header>

  <main class="compare-main">
    {#if showLoading}
      <div class="compare-empty">載入中…</div>
    {:else if errorMsg}
      <div class="compare-empty">{errorMsg}</div>
    {:else if pairA && pairB}
      <button class="compare-card" type="button" onclick={() => openInEditor(pairA)} title="在 Editor 中開啟">
        <div class="compare-card-image">
          <img src="/img/committed/{pairA.id}{pairA.ext}" alt={pairA.originalName || pairA.id} draggable="false" />
        </div>
        <div class="compare-card-info">
          <Rating readonly value={pairA.rating ?? 0} size="0.875rem" />
          <div class="compare-card-info-tags">
            {#each pairA.tags as tag}
              <span class="chip">{tag}</span>
            {/each}
          </div>
        </div>
      </button>

      <button class="compare-card" type="button" onclick={() => openInEditor(pairB)} title="在 Editor 中開啟">
        <div class="compare-card-image">
          <img src="/img/committed/{pairB.id}{pairB.ext}" alt={pairB.originalName || pairB.id} draggable="false" />
        </div>
        <div class="compare-card-info">
          <Rating readonly value={pairB.rating ?? 0} size="0.875rem" />
          <div class="compare-card-info-tags">
            {#each pairB.tags as tag}
              <span class="chip">{tag}</span>
            {/each}
          </div>
        </div>
      </button>
    {/if}
  </main>

  <footer class="compare-footer">
    <button class="btn btn-primary" onclick={loadPair} disabled={loading}>
      <IconArrowsShuffle size={18} />
      換一組 <span class="kbd">Space</span>
    </button>
  </footer>
</div>

<style>
  .page-compare {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  /* ─── Header ─────────────────────────────────────────────────────────── */
  .compare-header-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .compare-count {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-dim);
    white-space: nowrap;
    margin-left: auto;
  }

  /* ─── Main ───────────────────────────────────────────────────────────── */
  .compare-main {
    display: flex;
    gap: 1rem 0.5rem;
    padding: 1rem;
    flex: 1;
    min-height: 0;
  }

  .compare-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 2);
    overflow: hidden;
    cursor: pointer;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;

    &:hover {
      border-color: var(--border-hover);
      box-shadow: 0 0 0 1px var(--border-hover);
    }
  }

  .compare-card-image {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    min-height: 0;
    background: var(--bg);

    & img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }

  .compare-card-info {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--border);
  }

  .compare-card-info-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .compare-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
    font-size: 0.875rem;
  }

  /* ─── Footer ─────────────────────────────────────────────────────────── */
  .compare-footer {
    display: grid;
    place-items: center;
    height: 3rem;
    background: var(--bg-card);
    border-top: 1px solid var(--border);
  }

  /* 換一組按鈕在 loading 時保持原本外觀，避免 opacity 閃爍 */
  .compare-footer :global(.btn:disabled) {
    opacity: 1;
    cursor: pointer;
  }
</style>
