import { tick } from "svelte";
import { toasts, dismissToast, finalizeRemoval, pauseAll, resumeAll } from "$lib/client/toast.js";
import type { ToastItem } from "$lib/client/toast.js";

/**
 * Toast 堆疊通知組件的配置選項
 */
type ToastOptions = {
  /** 項目間展開時的間距 (px) */
  gap: number;
  /** 折疊模式下每層偏移量 (px) */
  collapsedOffset: number;
  /** 折疊模式下每層縮小步距 */
  collapsedScaleStep: number;
  /** 折疊模式下每層透明度步距 */
  collapsedOpacityStep: number;
  /** 最大可見 toast 數量 */
  maxVisible: number;
};

/**
 * 建立 Toast 堆疊通知邏輯的核心工廠函數
 */
export function createToast(options: ToastOptions) {
  /** 目前所有 toast 項目 */
  let items = $state<ToastItem[]>([]);
  /** 滑鼠是否懸停在容器上 */
  let hovered = $state(false);
  /** 各 toast 的實際高度記錄 */
  let heights: Map<number, number> = $state(new Map());
  /** 正在進入動畫中的 toast ID 集合 */
  let entering: Set<number> = $state(new Set());

  // 訂閱全域 toast store
  toasts.subscribe((v) => {
    const prevIds = new Set(items.map((t) => t.id));
    const newIds = v.filter((t) => !prevIds.has(t.id)).map((t) => t.id);

    items = v;

    if (newIds.length > 0) {
      entering = new Set([...entering, ...newIds]);
      tick().then(() => {
        requestAnimationFrame(() => {
          entering = new Set();
        });
      });
    }
  });

  // ---

  /** 計算指定索引 toast 的垂直偏移量 */
  function getOffset(index: number): number {
    if (hovered) {
      let y = 0;
      for (let i = 0; i < index; i++) {
        const h = heights.get(items[i]?.id ?? -1) ?? 48;
        y += h + options.gap;
      }
      return y;
    }
    return index * options.collapsedOffset;
  }

  /** 計算指定索引 toast 的縮放比例 */
  function getScale(index: number): number {
    if (hovered) return 1;
    return Math.max(0.9, 1 - index * options.collapsedScaleStep);
  }

  /** 計算指定索引 toast 的透明度 */
  function getOpacity(index: number, toast: ToastItem): number {
    if (toast.removing) return 0;
    if (hovered) return index < options.maxVisible ? 1 : 0;
    return Math.max(0, 1 - index * options.collapsedOpacityStep);
  }

  /** 計算容器總高度（子元素均為 absolute，需手動撐高以供 hover 偵測） */
  function getContainerHeight(): number {
    const visibleItems = items.filter((t) => !t.removing);
    if (visibleItems.length === 0) return 0;

    if (hovered) {
      let total = 0;
      for (let i = 0; i < visibleItems.length && i < options.maxVisible; i++) {
        total += (heights.get(visibleItems[i].id) ?? 48) + options.gap;
      }
      return total - options.gap;
    }

    const lastIdx = Math.min(visibleItems.length - 1, options.maxVisible - 1);
    const lastH = heights.get(visibleItems[lastIdx]?.id ?? -1) ?? 48;
    return lastIdx * options.collapsedOffset + lastH;
  }

  /** 測量並記錄指定 toast 的實際高度 */
  function measureHeight(id: number, el: HTMLDivElement | null) {
    if (!el) return;
    const h = el.offsetHeight;
    if (heights.get(id) !== h) {
      heights = new Map(heights).set(id, h);
    }
  }

  // ---

  /** 處理容器滑鼠進入事件，展開堆疊並暫停所有計時器 */
  function handleContainerMouseEnter() {
    hovered = true;
    pauseAll();
  }

  /** 處理容器滑鼠離開事件，折疊堆疊並恢復所有計時器 */
  function handleContainerMouseLeave() {
    hovered = false;
    resumeAll();
  }

  /** 處理 toast 過渡動畫結束事件，在退出動畫完成後從 DOM 移除 */
  function handleTransitionEnd(e: TransitionEvent, toast: ToastItem) {
    if (e.propertyName !== "opacity" || e.target !== e.currentTarget) return;
    if (toast.removing) {
      finalizeRemoval(toast.id);
    }
  }

  /** 處理關閉按鈕點擊事件，立即開始移除指定 toast */
  function handleCloseClick(id: number) {
    dismissToast(id);
  }

  // ---

  /** Svelte action：掛載時測量元素高度，並透過 ResizeObserver 持續追蹤 */
  function measureEl(node: HTMLDivElement, id: number) {
    measureHeight(id, node);
    const ro = new ResizeObserver(() => measureHeight(id, node));
    ro.observe(node);
    return {
      destroy() {
        ro.disconnect();
        const m = new Map(heights);
        m.delete(id);
        heights = m;
      },
    };
  }

  // ---

  return {
    /** 存取目前所有 toast 項目的 getter */
    get items() {
      return items;
    },
    /** 存取容器懸停狀態的 getter */
    get hovered() {
      return hovered;
    },
    /** 存取進入動畫 ID 集合的 getter */
    get entering() {
      return entering;
    },
    /** 計算指定索引 toast 的垂直偏移量 */
    getOffset,
    /** 計算指定索引 toast 的縮放比例 */
    getScale,
    /** 計算指定索引 toast 的透明度 */
    getOpacity,
    /** 計算容器總高度 */
    getContainerHeight,
    /** Svelte action：持續追蹤元素高度 */
    measureEl,
    /** 處理容器滑鼠進入事件，展開堆疊並暫停所有計時器 */
    handleContainerMouseEnter,
    /** 處理容器滑鼠離開事件，折疊堆疊並恢復所有計時器 */
    handleContainerMouseLeave,
    /** 處理 toast 過渡動畫結束事件，在退出動畫完成後從 DOM 移除 */
    handleTransitionEnd,
    /** 處理關閉按鈕點擊事件，立即開始移除指定 toast */
    handleCloseClick,
  };
}
