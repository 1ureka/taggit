<script lang="ts">
  import { page, navigating } from "$app/state";
  import { goto } from "$app/navigation";
  import type { Tag } from "$lib/database";
  import { TagQuery } from "$lib/query-spec";
  import { imgSrc } from "$lib/image/client";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  import { IconAlertTriangleFilled, IconEyeOff } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";

  import { PREVIEW_COUNT, HOVER_DEBOUNCE, previewCache, requestPreview } from "./previews";
  import type { TagSnapshot } from "../logic/changeset";

  type Props = {
    /** 當頁的標籤（隨 URL 查詢參數由 load 提供） */
    items: Tag[];
    /** 目前查詢條件下的標籤總數 */
    total: number;
    /** 每個標籤目前被擺在畫布哪裡（`group:<id>` / `delete` / `toggle`） */
    placement: Map<string, string>;
    /** 已選取的標籤名 */
    selectedNames: Set<string>;
    /** 池是否為當前拖放目標 */
    dropping: boolean;
    /** 點擊 chip：切換選取 */
    ontoggleselect: (snap: TagSnapshot) => void;
    /** chip 拖曳開始/結束 */
    ondragstart: (snap: TagSnapshot) => void;
    ondragend: () => void;
    /** 池作為拖放目標（把畫布上的標籤拖回來取消排程） */
    onpooldragover: (e: DragEvent) => void;
    onpooldragleave: () => void;
    onpooldrop: (e: DragEvent) => void;
  };

  let {
    items,
    total,
    placement,
    selectedNames,
    dropping,
    ontoggleselect,
    ondragstart,
    ondragend,
    onpooldragover,
    onpooldragleave,
    onpooldrop,
  }: Props = $props();

  const toSnapshot = (tag: Tag): TagSnapshot => ({ name: tag.name, count: tag.count, hidden: tag.meta.hidden });

  // ─── 分頁：query 由 URL 驅動（Toolbar 的搜尋/排序/篩選同一套契約），翻頁直接 goto ───

  const query = $derived(TagQuery.fromSearchParams(page.url.searchParams));
  const pageNum = $derived(query.list.page);
  const pageCount = $derived(Math.max(1, Math.ceil(total / 100)));
  const navPending = $derived(!!navigating.to);

  let scrollerEl = $state<HTMLElement>();

  $effect(() => {
    items; // 換頁/篩選後資料一到就捲回頂端
    scrollerEl?.scrollTo({ top: 0 });
  });

  const gotoPage = (p: number) => {
    const q = query.with({ list: query.list.with({ page: p }) });
    const qs = q.toSearchParams(new URLSearchParams(location.search)).toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  };

  // ─── 懸停預覽：hover 去抖後才查，快取由 previews.ts 管理 ───

  let hovered = $state<Tag | null>(null);
  let hoverTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    return () => clearTimeout(hoverTimer);
  });

  const handleChipEnter = (tag: Tag) => {
    hovered = tag; // 不主動清除；tooltip 的開關由 attachment 自己管理
    clearTimeout(hoverTimer);
    if (tag.count === 0) return;
    hoverTimer = setTimeout(() => requestPreview(tag.name), HOVER_DEBOUNCE);
  };

  const handleChipLeave = () => {
    clearTimeout(hoverTimer);
  };

  const placementLabel: Record<string, string> = {
    delete: "已排入刪除區",
    toggle: "已排入顯隱切換區",
  };

  const chipTitle = (tag: Tag) => {
    const placed = placement.get(tag.name);
    const state = placed ? (placed.startsWith("group:") ? "已排入合併堆" : (placementLabel[placed] ?? "")) : "";
    return `${tag.name}（${tag.count} 張）${state ? `— ${state}` : "— 拖到右側分堆，或點選後用按鈕加入"}`;
  };
</script>

{#snippet loadingDisplay()}
  <div class="thumbs">
    {#each { length: PREVIEW_COUNT }, i (i)}
      <div class="thumb placeholder"></div>
    {/each}
  </div>
{/snippet}

{#snippet tagTooltip()}
  {#if hovered}
    {@const entry = previewCache.get(hovered.name)}
    <div class="tip">
      <div class="tip-meta">
        <span class="tip-name ellipsis">{hovered.name}</span>
        <span class="tip-count">×{hovered.count}</span>
        {#if hovered.meta.hidden}
          <span class="tip-hidden"><IconEyeOff size={12} />隱藏</span>
        {/if}
      </div>

      {#if hovered.count === 0}
        <span class="tip-empty">沒有已提交的圖片使用此標籤</span>
      {:else if entry === undefined || entry === "loading"}
        {@render loadingDisplay()}
      {:else}
        <div class="thumbs">
          {#each entry as img (img.id)}
            <img class="thumb" src={imgSrc(img.id, "sm")} alt={img.name} decoding="async" />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

<section
  class="pool"
  class:dropping
  role="list"
  aria-label="標籤池"
  ondragover={onpooldragover}
  ondragleave={onpooldragleave}
  ondrop={onpooldrop}
>
  <div class="chips" bind:this={scrollerEl} class:fetching={navPending}>
    {#each items as tag (tag.name)}
      {@const placed = placement.get(tag.name)}
      <button
        type="button"
        class="pool-chip"
        class:selected={selectedNames.has(tag.name)}
        class:in-group={placed?.startsWith("group:")}
        class:in-delete={placed === "delete"}
        class:in-toggle={placed === "toggle"}
        draggable="true"
        aria-pressed={selectedNames.has(tag.name)}
        title={chipTitle(tag)}
        onclick={() => ontoggleselect(toSnapshot(tag))}
        ondragstart={() => ondragstart(toSnapshot(tag))}
        {ondragend}
        onmouseenter={() => handleChipEnter(tag)}
        onmouseleave={handleChipLeave}
        onfocus={() => handleChipEnter(tag)}
        {@attach tooltip({ content: tagTooltip, placement: "bottom" })}
      >
        <span class="ellipsis">{tag.name}</span>
        <span class="chip-meta">
          {#if tag.meta.hidden}<IconAlertTriangleFilled size="0.75rem" />{/if}
          <span class="chip-count">{tag.count}</span>
        </span>
      </button>
    {:else}
      <p class="empty">沒有符合的標籤</p>
    {/each}
  </div>

  <div class="pagination">
    <Button
      variant="ghost"
      status={pageNum <= 1 || navPending ? "disabled" : undefined}
      onclick={() => gotoPage(pageNum - 1)}
    >
      上一頁
    </Button>
    <span class="page-indicator">第 {pageNum} / {pageCount} 頁 · 共 {total} 個</span>
    <Button
      variant="ghost"
      status={pageNum >= pageCount || navPending ? "disabled" : undefined}
      onclick={() => gotoPage(pageNum + 1)}
    >
      下一頁
    </Button>
  </div>
</section>

<style>
  .pool {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    transition: background 0.15s ease;

    &.dropping {
      background: var(--color-bg-hover);
    }
  }

  /* ─── chip 流（100/頁，分頁取代虛擬化）─── */

  .chips {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 0.375rem;
    transition: opacity 0.15s ease;

    &.fetching {
      opacity: 0.6;
    }
  }

  .empty {
    font: var(--font-body2);
    color: var(--color-text-muted);
  }

  /* 素面 chip 外殼比照 Chip 積木的 token，狀態樣式（選取/已放置）在外殼上組合 */
  .pool-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: 16rem;
    padding: 0.1875rem 0.625rem;
    font: var(--font-body2);
    color: hsl(from var(--color-text) h s l / 0.8);
    background: transparent;
    border: var(--border-style);
    border-radius: 9999px;
    cursor: grab;
    user-select: none;
    transition: all 0.15s ease;

    &:hover {
      background: var(--color-bg-hover);
      border-color: var(--color-border-hover);
    }

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }

    &.selected {
      background: var(--color-bg-active);
      border-color: var(--color-info);
      color: var(--color-text);
    }

    &.in-group {
      border-color: hsl(from var(--color-info) h s l / 0.6);
      opacity: 0.65;
    }

    &.in-delete {
      border-color: hsl(from var(--color-error) h s l / 0.6);
      opacity: 0.65;
    }

    &.in-toggle {
      border-color: hsl(from var(--color-warning) h s l / 0.6);
      opacity: 0.65;
    }
  }

  .chip-meta {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-text-muted);
  }

  .chip-count {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }

  /* ─── 分頁列 ─── */

  .pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-top: var(--border-style);
  }

  .page-indicator {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }

  /* ─── 懸停 tooltip（渲染在全域 Tooltip 的反色氣泡內，色彩用 currentColor 推導）─── */

  .tip {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-width: 16rem;
    padding: 0.125rem;
  }

  .tip-meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  .tip-name {
    min-width: 0;
    font: var(--font-body2);
    font-weight: 600;
  }

  .tip-count {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    opacity: 0.7;
  }

  .tip-hidden {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    font: var(--font-caption);
    font-weight: normal;
    opacity: 0.7;
  }

  .tip-empty {
    font: var(--font-caption);
    font-weight: normal;
    opacity: 0.7;
  }

  .thumbs {
    display: flex;
    gap: 0.25rem;
  }

  .thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: calc(var(--border-radius) / 1.5);
    background: hsl(from currentColor h s l / 0.15);
  }

  .thumb.placeholder {
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 0.9;
    }
  }
</style>
