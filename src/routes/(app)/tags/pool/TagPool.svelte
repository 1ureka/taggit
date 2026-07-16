<script lang="ts">
  import type { Tag } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import { formatError } from "$lib/utils/shared";
  import { addToast } from "$lib/components/floating/toast-events";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  import { IconSearch, IconAlertTriangleFilled, IconEyeOff } from "$lib/icons";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  import { PAGE_SIZE, fetchPool, type PoolQuery } from "./pool";
  import { PREVIEW_COUNT, HOVER_DEBOUNCE, previewCache, requestPreview } from "./previews";
  import type { TagSnapshot } from "../logic/changeset";

  type Props = {
    /** load 回傳的第 1 頁（預設查詢）；重掛（{#key}）時作為初始資料 */
    firstPage: Tag[];
    /** 預設查詢的標籤總數 */
    firstTotal: number;
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
    firstPage,
    firstTotal,
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

  const id = $props.id();

  const toSnapshot = (tag: Tag): TagSnapshot => ({ name: tag.name, count: tag.count, hidden: tag.meta.hidden });

  // ─── 伺服器分頁：控制項變動（回第 1 頁）與翻頁都是 client fetch ───

  let tags = $derived(firstPage);
  let total = $derived(firstTotal);
  let pageNum = $state(1);
  let fetching = $state(false);

  let search = $state("");
  let sortKey = $state<string | undefined>("count");
  let hiddenKey = $state<string | undefined>("all");

  let scrollerEl = $state<HTMLElement>();

  const pageCount = $derived(Math.max(1, Math.ceil(total / PAGE_SIZE)));

  let requestSeq = 0;
  let searchTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    return () => clearTimeout(searchTimer);
  });

  const currentQuery = (page: number): PoolQuery => ({
    search,
    sort: (sortKey ?? "count") as PoolQuery["sort"],
    hidden: (hiddenKey ?? "all") as PoolQuery["hidden"],
    page,
  });

  /** 查詢一頁；過期回應以序號丟棄 */
  async function run(page: number) {
    const seq = ++requestSeq;
    fetching = true;
    try {
      const result = await fetchPool(currentQuery(page));
      if (seq !== requestSeq) return;
      tags = result.items;
      total = result.total;
      pageNum = page;
      scrollerEl?.scrollTo({ top: 0 });
    } catch (e) {
      if (seq === requestSeq) addToast({ message: formatError(e), variant: "error" });
    } finally {
      if (seq === requestSeq) fetching = false;
    }
  }

  /** 搜尋輸入去抖；排序/顯隱變動即查；任何條件變動一律回到第 1 頁 */
  const handleSearchInput = () => {
    requestSeq++; // 遞增序號讓在途回應立即失效
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => run(1), 250);
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

{#snippet sortOption(key: string)}{key === "count" ? "使用數" : "名稱"}{/snippet}
{#snippet hiddenOption(key: string)}{key === "all" ? "全部" : key === "hidden" ? "僅隱藏" : "僅可見"}{/snippet}

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
  <div class="controls">
    <TextInput
      label="搜尋標籤"
      labelHidden
      placeholder="搜尋標籤…"
      autocomplete="off"
      bind:value={search}
      oninput={handleSearchInput}
      style="width: 100%"
    >
      {#snippet adornmentLeft()}
        <span class="search-icon"><IconSearch size={18} /></span>
      {/snippet}
    </TextInput>

    <Select
      id="{id}-sort"
      aria-label="排序"
      options={["count", "name"]}
      option={sortOption}
      bind:value={sortKey}
      onchange={() => run(1)}
      matchWidth={false}
    />
    <Select
      id="{id}-hidden"
      aria-label="顯隱篩選"
      options={["all", "hidden", "visible"]}
      option={hiddenOption}
      bind:value={hiddenKey}
      onchange={() => run(1)}
      matchWidth={false}
    />
  </div>

  <div class="chips" bind:this={scrollerEl} class:fetching>
    {#each tags as tag (tag.name)}
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
      status={pageNum <= 1 || fetching ? "disabled" : undefined}
      onclick={() => run(pageNum - 1)}
    >
      上一頁
    </Button>
    <span class="page-indicator">第 {pageNum} / {pageCount} 頁 · 共 {total} 個</span>
    <Button
      variant="ghost"
      status={pageNum >= pageCount || fetching ? "disabled" : undefined}
      onclick={() => run(pageNum + 1)}
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

  .controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: var(--border-style);

    & > :global(:first-child) {
      flex: 1;
      min-width: 8rem;
      max-width: 16rem;
    }
  }

  .search-icon {
    display: flex;
    align-items: center;
    padding-left: 0.75rem;
    color: var(--color-text-muted);
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
