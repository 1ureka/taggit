/**
 * @file 瀑布流虛擬化器
 * @description Svelte 5 響應式模組，自動監聽視窗滾動與縮放，
 *              透過 RAF 聚合器限制計算頻率，回傳當前可見項目與總高度
 */

import { RAFAggregator } from "$lib/client/raf-aggregator.js";
import { getVirtualizedItems, type Layout, type VirtualizedItem } from "./masonry.js";

// ─── Virtualizer ────────────────────────────────────────────────────────

/**
 * 建立響應式瀑布流虛擬化器
 *
 * **必須在組件初始化階段呼叫**（因為內部使用 `$effect`）。
 *
 * - 當 `getLayout()` 回傳的佈局資料變更時，立即重新計算可見項目
 * - 自動監聽 scroll container scroll / window resize，透過 20 FPS 的 RAF 聚合器限制頻率
 *
 * @param getLayout         - 響應式 getter，回傳當前瀑布流佈局（tracks + yMax）
 * @param getContainer      - getter，回傳瀑布流容器 DOM 元素
 * @param getScrollContainer - getter，回傳實際捲動容器（取代 window scroll）
 */
export function createVirtualizer<T extends { width: number; height: number }>(
  getLayout: () => Layout<T>,
  getContainer: () => HTMLElement | null,
  getScrollContainer: () => HTMLElement | null,
) {
  let visibleItems = $state<VirtualizedItem<T>[]>([]);
  let totalHeight = $state(0);

  function compute() {
    const container = getContainer();
    const layout = getLayout();

    if (!container || layout.tracks.length === 0 || layout.yMax <= 0) {
      visibleItems = [];
      totalHeight = 0;
      return;
    }

    const scrollContainer = getScrollContainer();
    if (!scrollContainer) return;

    const containerRect = container.getBoundingClientRect();
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const localTop = Math.max(0, scrollContainerRect.top - containerRect.top);
    const localBottom = scrollContainerRect.bottom - containerRect.top;

    const result = getVirtualizedItems({
      tracks: layout.tracks,
      yMax: layout.yMax,
      containerWidth: container.clientWidth,
      localTop,
      localBottom,
    });

    visibleItems = result.visibleItems;
    totalHeight = result.totalHeight;
  }

  // 當佈局變更時立即重新計算
  $effect(() => {
    getLayout(); // 建立響應式依賴追蹤
    compute();
  });

  // 掛載 scroll / resize 監聽器（當 scroll container 改變時重新綁定）
  $effect(() => {
    const scrollContainer = getScrollContainer();
    if (!scrollContainer) return;

    const aggregator = new RAFAggregator(compute, { fps: 20, idleTimeout: 500 });
    const handleEvent = () => aggregator.notify();

    scrollContainer.addEventListener("scroll", handleEvent, { passive: true });
    window.addEventListener("resize", handleEvent);

    return () => {
      scrollContainer.removeEventListener("scroll", handleEvent);
      window.removeEventListener("resize", handleEvent);
      aggregator.dispose();
    };
  });

  return {
    get visibleItems() {
      return visibleItems;
    },
    get totalHeight() {
      return totalHeight;
    },
  };
}
