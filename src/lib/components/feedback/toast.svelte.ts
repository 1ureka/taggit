import { tick } from "svelte";
import type { ToastEventName, ToastPayload, ToastType } from "$lib/ui/types";
import type { ToastProgressStartEventName, ToastProgressStartPayload } from "$lib/ui/types";
import type { ToastProgressUpdateEventName, ToastProgressUpdatePayload } from "$lib/ui/types";
import type { ToastProgressDoneEventName, ToastProgressDonePayload } from "$lib/ui/types";

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
  /** 進度值 (0~1)；`undefined` 表示非進度類型 */
  progress?: number;
}

/**
 * 各 Toast 項目的預計算顯示參數
 */
interface ToastComputed {
  /** 垂直偏移量 (px) */
  y: number;
  /** 縮放比例 */
  scale: number;
  /** 透明度 */
  opacity: number;
  /** 是否正在執行進入動畫 */
  isEntering: boolean;
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
 * Toast 堆疊通知的互動邏輯
 */
export class Toast {
  /** 目前所有 toast 項目 */
  items = $state<ToastItem[]>([]);
  /** 滑鼠是否懸停在容器上 */
  #hovered = $state(false);
  /** 各 toast 的實際高度記錄 */
  #heights: Map<number, number> = $state(new Map());
  /** 正在進入動畫中的 toast ID 集合 */
  #entering: Set<number> = $state(new Set());

  // ---

  /** 各項目的預計算顯示參數（y、scale、opacity、isEntering） */
  computed: ToastComputed[];
  /** 容器總高度（子元素均為 absolute，需手動撐高以供 hover 偵測） */
  containerHeight: number;

  // ---

  #nextId = 0;
  #timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(private options: ToastOptions) {
    this.computed = $derived(
      this.items.map((toast, i) => ({
        y: this.#computeOffset(i),
        scale: this.#computeScale(i),
        opacity: this.#computeOpacity(i, toast),
        isEntering: this.#entering.has(toast.id),
      })),
    );

    this.containerHeight = $derived(this.#computeContainerHeight());

    $effect(() => {
      const onToastAdd = (e: Event) => {
        this.#addItem((e as CustomEvent<ToastPayload>).detail);
      };
      const eventName: ToastEventName = "toast:add";
      window.addEventListener(eventName, onToastAdd);
      return () => window.removeEventListener(eventName, onToastAdd);
    });

    $effect(() => {
      const onStart = (e: Event) => {
        this.#addProgressItem((e as CustomEvent<ToastProgressStartPayload>).detail);
      };
      const onUpdate = (e: Event) => {
        this.#updateProgressItem((e as CustomEvent<ToastProgressUpdatePayload>).detail);
      };
      const onDone = (e: Event) => {
        this.#doneProgressItem((e as CustomEvent<ToastProgressDonePayload>).detail);
      };
      const startName: ToastProgressStartEventName = "toast:progress:start";
      const updateName: ToastProgressUpdateEventName = "toast:progress:update";
      const doneName: ToastProgressDoneEventName = "toast:progress:done";
      window.addEventListener(startName, onStart);
      window.addEventListener(updateName, onUpdate);
      window.addEventListener(doneName, onDone);
      return () => {
        window.removeEventListener(startName, onStart);
        window.removeEventListener(updateName, onUpdate);
        window.removeEventListener(doneName, onDone);
      };
    });
  }

  // ---

  #clearTimer(id: number) {
    const handle = this.#timers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      this.#timers.delete(id);
    }
  }

  #scheduleRemoval(id: number, delay: number) {
    this.#clearTimer(id);
    const handle = setTimeout(() => {
      this.#timers.delete(id);
      this.#dismiss(id);
    }, delay);
    this.#timers.set(id, handle);
  }

  // ---

  #addItem(payload: ToastPayload) {
    const id = this.#nextId++;
    const now = Date.now();
    const item: ToastItem = { id, ...payload, removing: false, createdAt: now, remaining: payload.duration };

    const next = [item, ...this.items];
    for (let i = this.options.maxVisible; i < next.length; i++) {
      if (!next[i].removing) {
        this.#scheduleRemoval(next[i].id, 0);
      }
    }
    this.items = next;

    if (payload.duration > 0) {
      this.#scheduleRemoval(id, payload.duration);
    }

    this.#entering = new Set([...this.#entering, id]);
    tick().then(() => {
      requestAnimationFrame(() => {
        this.#entering = new Set();
      });
    });
  }

  #addProgressItem(payload: ToastProgressStartPayload) {
    const id = this.#nextId++;
    const now = Date.now();
    const item: ToastItem = {
      id,
      message: payload.label,
      type: "info",
      duration: 0,
      removing: false,
      createdAt: now,
      remaining: 0,
      progress: 0,
    };

    this.items = [item, ...this.items];
    this.#entering = new Set([...this.#entering, id]);
    tick().then(() => {
      requestAnimationFrame(() => {
        this.#entering = new Set();
      });
    });

    payload.resolveId(id);
  }

  #updateProgressItem(payload: ToastProgressUpdatePayload) {
    this.items = this.items.map((t) =>
      t.id === payload.id ? { ...t, message: payload.message, progress: payload.progress } : t,
    );
  }

  #doneProgressItem(payload: ToastProgressDonePayload) {
    this.items = this.items.map((t) =>
      t.id === payload.id
        ? {
            ...t,
            message: payload.message,
            type: payload.type,
            progress: undefined,
            duration: payload.duration,
            createdAt: Date.now(),
            remaining: payload.duration,
          }
        : t,
    );
    if (payload.duration > 0) {
      this.#scheduleRemoval(payload.id, payload.duration);
    }
  }

  #dismiss(id: number) {
    this.#clearTimer(id);
    this.items = this.items.map((t) => (t.id === id ? { ...t, removing: true } : t));
  }

  #finalizeRemoval(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }

  #pauseAll() {
    const now = Date.now();
    for (const [, handle] of this.#timers) clearTimeout(handle);
    this.#timers.clear();

    this.items = this.items.map((t) => {
      if (t.removing || t.duration <= 0) return t;
      const elapsed = now - t.createdAt;
      return { ...t, remaining: Math.max(0, t.remaining - elapsed) };
    });
  }

  #resumeAll() {
    const now = Date.now();
    this.items = this.items.map((t) => {
      if (t.removing || t.duration <= 0) return t;
      const remaining = t.remaining;
      if (remaining > 0) {
        this.#scheduleRemoval(t.id, remaining);
      } else {
        this.#scheduleRemoval(t.id, 0);
      }
      return { ...t, createdAt: now, remaining };
    });
  }

  // ---

  #measureHeight(id: number, el: HTMLDivElement | null) {
    if (!el) return;
    const h = el.offsetHeight;
    if (this.#heights.get(id) !== h) {
      this.#heights = new Map(this.#heights).set(id, h);
    }
  }

  #computeOffset(index: number): number {
    if (this.#hovered) {
      let y = 0;
      for (let i = 0; i < index; i++) {
        const h = this.#heights.get(this.items[i]?.id ?? -1) ?? 48;
        y += h + this.options.gap;
      }
      return y;
    }
    return index * this.options.collapsedOffset;
  }

  #computeScale(index: number): number {
    if (this.#hovered) return 1;
    return Math.max(0.9, 1 - index * this.options.collapsedScaleStep);
  }

  #computeOpacity(index: number, toast: ToastItem): number {
    if (toast.removing) return 0;
    if (this.#hovered) return index < this.options.maxVisible ? 1 : 0;
    return Math.max(0, 1 - index * this.options.collapsedOpacityStep);
  }

  #computeContainerHeight(): number {
    const visibleItems = this.items.filter((t) => !t.removing);
    if (visibleItems.length === 0) return 0;

    if (this.#hovered) {
      let total = 0;
      for (let i = 0; i < visibleItems.length && i < this.options.maxVisible; i++) {
        total += (this.#heights.get(visibleItems[i].id) ?? 48) + this.options.gap;
      }
      return total - this.options.gap;
    }

    const lastIdx = Math.min(visibleItems.length - 1, this.options.maxVisible - 1);
    const lastH = this.#heights.get(visibleItems[lastIdx]?.id ?? -1) ?? 48;
    return lastIdx * this.options.collapsedOffset + lastH;
  }

  // ---

  /** 處理容器滑鼠進入事件，展開堆疊並暫停所有計時器 */
  handleContainerMouseEnter = () => {
    this.#hovered = true;
    this.#pauseAll();
  };

  /** 處理容器滑鼠離開事件，折疊堆疊並恢復所有計時器 */
  handleContainerMouseLeave = () => {
    this.#hovered = false;
    this.#resumeAll();
  };

  // ---

  /** 處理 toast 過渡動畫結束事件，在退出動畫完成後從 DOM 移除 */
  handleTransitionEnd = (e: TransitionEvent, toast: ToastItem) => {
    if (e.propertyName !== "opacity" || e.target !== e.currentTarget) return;
    if (toast.removing) {
      this.#finalizeRemoval(toast.id);
    }
  };

  /** 處理關閉按鈕點擊事件，立即開始移除指定 toast */
  handleCloseClick = (id: number) => {
    this.#dismiss(id);
  };

  // ---

  /** Svelte action：掛載時測量元素高度，並透過 ResizeObserver 持續追蹤 */
  measureEl = (node: HTMLDivElement, id: number) => {
    this.#measureHeight(id, node);
    const ro = new ResizeObserver(() => this.#measureHeight(id, node));
    ro.observe(node);
    return {
      destroy: () => {
        ro.disconnect();
        const m = new Map(this.#heights);
        m.delete(id);
        this.#heights = m;
      },
    };
  };
}
