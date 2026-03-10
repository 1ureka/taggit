import { tick } from "svelte";
import { TOAST_EVENT, type ToastPayload, type ToastType } from "$lib/client/toast.js";

/**
 * Toast 項目資料結構
 */
interface ToastItem {
  /** 唯一識別 ID */
  id: number;
  /** Toast 訊息內容 */
  message: string;
  /** Toast 類型 */
  type: ToastType;
  /** 顯示時間 (ms) */
  duration: number;
  /** 是否正在移除中 */
  removing: boolean;
  /** 建立時間戳 */
  createdAt: number;
  /** 剩餘顯示時間 (ms) */
  remaining: number;
}

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

  /** 遞增 ID 計數器 */
  let nextId = 0;
  /** 計時器映射：toast id → setTimeout handle */
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  // ---

  /** 清除指定 toast 的待執行計時器 */
  function clearTimer(id: number) {
    const handle = timers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      timers.delete(id);
    }
  }

  /** 排程指定 toast 在延遲後開始退出動畫 */
  function scheduleRemoval(id: number, delay: number) {
    clearTimer(id);
    const handle = setTimeout(() => {
      timers.delete(id);
      dismiss(id);
    }, delay);
    timers.set(id, handle);
  }

  // ---

  /** 新增一筆 toast 項目（由 custom event 觸發） */
  function addItem(payload: ToastPayload) {
    const id = nextId++;
    const now = Date.now();
    const item: ToastItem = { id, ...payload, removing: false, createdAt: now, remaining: payload.duration };

    const next = [item, ...items];
    for (let i = options.maxVisible; i < next.length; i++) {
      if (!next[i].removing) {
        scheduleRemoval(next[i].id, 0);
      }
    }
    items = next;

    if (payload.duration > 0) {
      scheduleRemoval(id, payload.duration);
    }

    // 進入動畫追蹤
    entering = new Set([...entering, id]);
    tick().then(() => {
      requestAnimationFrame(() => {
        entering = new Set();
      });
    });
  }

  /** 標記 toast 為移除中，觸發退出動畫 */
  function dismiss(id: number) {
    clearTimer(id);
    items = items.map((t) => (t.id === id ? { ...t, removing: true } : t));
  }

  /** 從列表中完全移除 toast（退出動畫結束後呼叫） */
  function finalizeRemoval(id: number) {
    items = items.filter((t) => t.id !== id);
  }

  /** 暫停所有自動移除計時器（hover 時） */
  function pauseAll() {
    const now = Date.now();

    for (const [, handle] of timers) clearTimeout(handle);
    timers.clear();

    items = items.map((t) => {
      if (t.removing || t.duration <= 0) return t;
      const elapsed = now - t.createdAt;
      return { ...t, remaining: Math.max(0, t.remaining - elapsed) };
    });
  }

  /** 恢復所有自動移除計時器（hover 結束時） */
  function resumeAll() {
    const now = Date.now();
    items = items.map((t) => {
      if (t.removing || t.duration <= 0) return t;
      const remaining = t.remaining;
      if (remaining > 0) {
        scheduleRemoval(t.id, remaining);
      } else {
        scheduleRemoval(t.id, 0);
      }
      return { ...t, createdAt: now, remaining };
    });
  }

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
    dismiss(id);
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

  /** 監聯 window custom event，接收外部 addToast 派發的通知 */
  $effect(() => {
    function onToastAdd(e: Event) {
      addItem((e as CustomEvent<ToastPayload>).detail);
    }
    window.addEventListener(TOAST_EVENT, onToastAdd);
    return () => window.removeEventListener(TOAST_EVENT, onToastAdd);
  });

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
