/**
 * @file 瀑布流虛擬化器
 * @description Svelte 5 響應式模組，自動監聽視窗滾動與縮放，
 *              透過 RAF 聚合器限制計算頻率，回傳當前可見項目與總高度
 */

import { getVirtualizedItems, type Layout, type VirtualizedItem } from "./masonry.js";

// ─── RAFAggregator ──────────────────────────────────────────────────────

const EMPTY = Symbol("empty");

/**
 * 基於 requestAnimationFrame 的事件聚合器
 *
 * 將高頻率事件（滾動、縮放）聚合並限制回呼執行頻率，
 * 超過空閒時間後自動停止 tick 循環以節省資源。
 */
class RAFAggregator {
  private buffer: typeof EMPTY | true = EMPTY;
  private lastRunTime = 0;
  private lastUpdateTime = 0;
  private rafId: number | null = null;
  private readonly interval: number;
  private readonly idleTimeout: number;

  constructor(
    private readonly callback: () => void,
    options: { fps?: number; idleTimeout?: number } = {},
  ) {
    this.interval = 1000 / (options.fps || 60);
    this.idleTimeout = options.idleTimeout ?? 500;
  }

  /** 通知有新事件發生，啟動或延續 RAF 循環 */
  notify() {
    this.lastUpdateTime = performance.now();
    this.buffer = true;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (timestamp: number) => {
    if (timestamp - this.lastRunTime >= this.interval && this.buffer !== EMPTY) {
      this.callback();
      this.buffer = EMPTY;
      this.lastRunTime = timestamp;
    }

    if (timestamp - this.lastUpdateTime >= this.idleTimeout) {
      this.dispose();
      return;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  /** 停止 RAF 循環 */
  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}

// ─── Virtualizer ────────────────────────────────────────────────────────

/**
 * 建立響應式瀑布流虛擬化器
 *
 * **必須在組件初始化階段呼叫**（因為內部使用 `$effect`）。
 *
 * - 當 `getLayout()` 回傳的佈局資料變更時，立即重新計算可見項目
 * - 自動監聽 window scroll / resize，透過 20 FPS 的 RAF 聚合器限制頻率
 *
 * @param getLayout   - 響應式 getter，回傳當前瀑布流佈局（tracks + yMax）
 * @param getContainer - getter，回傳瀑布流容器 DOM 元素
 */
export function createVirtualizer<T extends { width: number; height: number }>(
  getLayout: () => Layout<T>,
  getContainer: () => HTMLElement | null,
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

    const rect = container.getBoundingClientRect();
    const result = getVirtualizedItems({
      tracks: layout.tracks,
      yMax: layout.yMax,
      containerRect: rect,
      containerWidth: container.clientWidth,
      viewportHeight: window.innerHeight,
    });

    visibleItems = result.visibleItems;
    totalHeight = result.totalHeight;
  }

  // 當佈局變更時立即重新計算
  $effect(() => {
    getLayout(); // 建立響應式依賴追蹤
    compute();
  });

  // 掛載 scroll / resize 監聽器（僅執行一次）
  $effect(() => {
    const aggregator = new RAFAggregator(compute, { fps: 20, idleTimeout: 500 });
    const handleEvent = () => aggregator.notify();

    window.addEventListener("scroll", handleEvent, { passive: true });
    window.addEventListener("resize", handleEvent);

    return () => {
      window.removeEventListener("scroll", handleEvent);
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
