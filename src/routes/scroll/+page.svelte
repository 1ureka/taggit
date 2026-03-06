<script lang="ts">
  import { IconArrowLeft, IconArrowUp } from "@tabler/icons-svelte";
  import { fly } from "svelte/transition";
  import { onMount, untrack } from "svelte";
  import type { ImageWithId, QueryResult } from "$lib/types.js";
  import { api } from "$lib/client/api.js";
  import { addToast } from "$lib/client/toast.js";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import Select from "$lib/components/Select.svelte";
  import { throttle } from "$lib/utils.js";
  import { createWeightBasedLayout } from "./masonry.js";
  import { createVirtualizer } from "./virtualizer.svelte.js";

  let { data } = $props();

  // ─── State ────────────────────────────────────────────────────────────
  const COLUMN_OPTIONS = [1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} 欄` }));

  let selectedTags = $state<string[]>([]);
  let rating = $state<number | undefined>(undefined);
  let ratingOp = $state<"gte" | "lte" | "eq">("gte");
  let sort = $state("committedAt");
  let order = $state("desc");

  let items = $state<ImageWithId[]>(untrack(() => data.initialItems));
  let total = $state(untrack(() => data.initialTotal));
  let loading = $state(false);
  let showFab = $state(false);
  let columns = $state(3);

  let containerEl = $state<HTMLElement | null>(null);
  let pageContentEl = $state<HTMLElement | null>(null);
  let layout = $derived(createWeightBasedLayout(items, columns));

  onMount(() => {
    const breakpoints = [
      { width: 1600, cols: 6 },
      { width: 1200, cols: 5 },
      { width: 900, cols: 4 },
      { width: 600, cols: 2 },
      { width: 0, cols: 1 },
    ];

    const width = window.innerWidth;
    columns = breakpoints.find((b) => width >= b.width)?.cols ?? 3;
  });

  /** 圖片牆虛擬化提供者 */
  const virtualizer = createVirtualizer(
    () => layout,
    () => containerEl,
    () => pageContentEl,
  );

  /** 執行查詢 */
  async function doSearch() {
    loading = true;

    try {
      const params = new URLSearchParams();
      params.set("sort", sort);
      params.set("order", order);
      if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
      if (rating !== undefined) {
        params.set("rating", String(rating));
        params.set("ratingOp", ratingOp);
      }

      const res = await api.get<QueryResult>(`/api/images?${params.toString()}`);
      if (res.ok && res.data) {
        items = res.data.items;
        total = res.data.total;
      } else {
        addToast(res.error || "載入失敗", "error");
      }
    } catch {
      addToast("載入失敗", "error");
    } finally {
      loading = false;
    }
  }

  /** 處理 main 滾動事件 */
  const handleScroll = throttle(() => {
    const el = pageContentEl;
    if (!el) return;
    showFab = el.scrollTop > 300;
  }, 150);

  /** 處理 FAB 點擊事件，滾動到頂部 */
  function handleFABClick() {
    pageContentEl?.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** 處理圖片雙擊事件，打開編輯器 */
  function handleImageDblClick(img: ImageWithId) {
    window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
  }
</script>

<svelte:head>
  <title>Scroll — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      首頁
    </a>
    <span class="page-header-title">垂直瀏覽</span>
    <div class="select-wrapper">
      <Select bind:value={columns} options={COLUMN_OPTIONS} />
    </div>
  </header>

  <main class="page-content slide-up" bind:this={pageContentEl} onscroll={handleScroll}>
    <div class="scroll-filter-area">
      <FilterBar bind:selectedTags bind:rating bind:ratingOp bind:sort bind:order onchange={doSearch} />
      <div class="scroll-result-count">
        <span>{total} 張結果</span>
      </div>
    </div>

    <!-- Masonry wall -->
    {#if items.length === 0 && !loading}
      <div class="scroll-empty">找不到符合的圖片</div>
    {/if}

    <div class="masonry-container" bind:this={containerEl} style:height="{virtualizer.totalHeight}px">
      {#each virtualizer.visibleItems as item (item.id)}
        <div
          class="masonry-item"
          style:transform="translate3d({item.pixelX}px, {item.pixelY}px, 0)"
          style:width="{item.pixelW}px"
          style:height="{item.pixelH}px"
        >
          <img
            class="masonry-img"
            src="/img/committed/{item.id}{item.ext}"
            alt={item.originalName || item.id}
            loading="lazy"
            draggable="false"
            ondblclick={() => handleImageDblClick(item)}
          />
        </div>
      {/each}
    </div>

    {#if loading}
      <div class="scroll-loading">載入中…</div>
    {/if}
  </main>
</div>

<!-- FAB: scroll to top -->
{#if showFab}
  <button
    class="scroll-fab"
    onclick={handleFABClick}
    aria-label="回到頂部"
    transition:fly={{ y: 16, duration: 200, opacity: 0 }}
  >
    <IconArrowUp size={20} />
  </button>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    align-items: stretch;
    overflow: hidden;
  }

  /* ─── Header ──────────────────────────────────────────── */
  .select-wrapper {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* ─── Main ────────────────────────────────────────────── */
  .page-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  /* ─── Filter area ─────────────────────────────────────── */
  .scroll-filter-area {
    padding: 1rem 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .scroll-result-count {
    font-size: 0.75rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
  }

  /* ─── Masonry ───────────────────────────────────────────── */
  .masonry-container {
    position: relative;
    margin-top: 0.75rem;
    overflow-x: hidden;
  }

  .masonry-item {
    position: absolute;
    top: 0;
    left: 0;
    padding: 3px;
  }

  .masonry-img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    border-radius: 4px;
    -webkit-user-select: none;
    user-select: none;
    animation: fadeIn 0.25s cubic-bezier(0, 0, 0.2, 1) forwards;
  }

  /* ─── States ──────────────────────────────────────────── */
  .scroll-empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 3rem 1rem;
  }

  .scroll-loading {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.8125rem;
    padding: 1.5rem 0 2rem;
  }

  /* ─── FAB ─────────────────────────────────────────────── */
  .scroll-fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: var(--bg);
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    transition:
      transform 0.15s,
      box-shadow 0.15s;
  }

  .scroll-fab:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  .scroll-fab:active {
    transform: scale(0.95);
  }
</style>
