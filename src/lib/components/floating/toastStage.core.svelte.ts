import { Spring } from "svelte/motion";
import { TOAST_ADD, TOAST_PROGRESS_UPDATE, TOAST_PROGRESS_DONE } from "$lib/components/floating/toast-events";
import { TOAST_HISTORY_SHOW, TOAST_HISTORY_HIDE } from "$lib/components/floating/toast-events";
import type { ToastVariant, ToastAddPayload } from "$lib/components/floating/toast-events";
import type { ToastProgressUpdatePayload, ToastProgressDonePayload } from "$lib/components/floating/toast-events";

interface ToastItem {
  /** 該項目的識別 id */
  id: number;
  /** 該項目的訊息 */
  message: string;
  /** 該項目的類型 */
  variant: ToastVariant;
  /** 該項目的要停留的時間 */
  duration: number;
  /** 該項目的創建時間 */
  createdAt: number;
  /** 該項目的剩餘停留時間 */
  remaining: number;
  /** 該項目的進度，`undefined` 表示非進度類型 */
  progress?: number;
}

interface ComputedItem {
  y: number;
  scale: number;
  opacity: number;
}

const GAP = 8;
const COLLAPSED_OFFSET = 8;
const COLLAPSED_SCALE_STEP = 0.05;
const COLLAPSED_OPACITY_STEP = 0.15;
const MAX_VISIBLE = 5;

/**
 * 堆疊的版面呈現
 */
class ToastLayout {
  /** 取得當前的通知陣列 */
  #items: () => Pick<ToastItem, "id">[];
  /** 每個 Toast 元素的高度快取 */
  #heights = $state(new Map<number, number>());
  /** 驅動所有 Toast 元素定位與樣式的共享 spring，其中摺疊 `0`, 展開 `1`  */
  hoverSpring = new Spring(0, { stiffness: 0.15, damping: 0.8 });
  /** 每個 Toast 元素當下的定位與樣式 */
  computed: ComputedItem[];
  /** 根據所有 Toast 元素計算出來的整體高度 */
  containerHeight: number;

  constructor(items: () => Pick<ToastItem, "id">[]) {
    this.#items = items;

    this.computed = $derived(
      this.#items().map((_, i) => ({
        y: this.#computeY(i),
        scale: this.#computeScale(i),
        opacity: this.#computeOpacity(i),
      })),
    );

    this.containerHeight = $derived(this.#computeContainerHeight());
  }

  /** Svelte Action，用於測量元素高度 */
  measureEl = (node: HTMLDivElement, id: number) => {
    const measure = () => {
      const h = node.offsetHeight;
      if (this.#heights.get(id) !== h) {
        this.#heights = new Map(this.#heights).set(id, h);
      }
    };
    measure();

    const ro = new ResizeObserver(measure);
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

  #computeY(index: number): number {
    const items = this.#items();
    let expandedY = 0;
    for (let i = 0; i < index; i++) {
      expandedY += (this.#heights.get(items[i]?.id ?? -1) ?? 48) + GAP;
    }
    const collapsedY = index * COLLAPSED_OFFSET;
    return collapsedY + (expandedY - collapsedY) * this.hoverSpring.current;
  }

  #computeScale(index: number): number {
    const collapsedScale = Math.max(0.9, 1 - index * COLLAPSED_SCALE_STEP);
    return collapsedScale + (1 - collapsedScale) * this.hoverSpring.current;
  }

  #computeOpacity(index: number): number {
    const collapsedOpacity = Math.max(0, 1 - index * COLLAPSED_OPACITY_STEP);
    const expandedOpacity = index < MAX_VISIBLE ? 1 : 0;
    return collapsedOpacity + (expandedOpacity - collapsedOpacity) * this.hoverSpring.current;
  }

  #computeContainerHeight(): number {
    const items = this.#items();
    if (items.length === 0) return 0;

    let expandedTotal = 0;
    for (let i = 0; i < items.length && i < MAX_VISIBLE; i++) {
      expandedTotal += (this.#heights.get(items[i].id) ?? 48) + GAP;
    }
    expandedTotal -= GAP;

    const lastIdx = Math.min(items.length - 1, MAX_VISIBLE - 1);
    const lastH = this.#heights.get(items[lastIdx]?.id ?? -1) ?? 48;
    const collapsedTotal = lastIdx * COLLAPSED_OFFSET + lastH;

    return collapsedTotal + (expandedTotal - collapsedTotal) * this.hoverSpring.current;
  }
}

/**
 * 通知即時堆疊的資料生命週期與事件監聽
 */
export class ToastStage {
  /** 當前的通知陣列 */
  items = $state<ToastItem[]>([]);
  /** 通知歷史目前是否開啟；開啟時不再新增 stage item、暫停所有倒數 */
  historyOpen = $state(false);

  layout = new ToastLayout(() => this.items);

  #timers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor() {
    $effect(() => {
      const onAdd = (e: Event) => {
        this.#add((e as CustomEvent<ToastAddPayload>).detail);
      };
      const onProgressUpdate = (e: Event) => {
        this.#updateProgress((e as CustomEvent<ToastProgressUpdatePayload>).detail);
      };
      const onProgressDone = (e: Event) => {
        this.#finishProgress((e as CustomEvent<ToastProgressDonePayload>).detail);
      };

      const onHistoryShow = () => {
        this.historyOpen = true;
        this.#pauseAll();
      };
      const onHistoryHide = () => {
        this.historyOpen = false;
        this.#resumeAll();
      };

      window.addEventListener(TOAST_ADD, onAdd);
      window.addEventListener(TOAST_PROGRESS_UPDATE, onProgressUpdate);
      window.addEventListener(TOAST_PROGRESS_DONE, onProgressDone);
      window.addEventListener(TOAST_HISTORY_SHOW, onHistoryShow);
      window.addEventListener(TOAST_HISTORY_HIDE, onHistoryHide);

      return () => {
        window.removeEventListener(TOAST_ADD, onAdd);
        window.removeEventListener(TOAST_PROGRESS_UPDATE, onProgressUpdate);
        window.removeEventListener(TOAST_PROGRESS_DONE, onProgressDone);
        window.removeEventListener(TOAST_HISTORY_SHOW, onHistoryShow);
        window.removeEventListener(TOAST_HISTORY_HIDE, onHistoryHide);
      };
    });
  }

  // ---

  #add(payload: ToastAddPayload) {
    // 歷史模式開啟期間，新的 toast 直接進歷史列表最上方，不再另外於堆疊彈出
    if (this.historyOpen) return;

    const item: ToastItem = { ...payload, createdAt: Date.now(), remaining: payload.duration };
    const next = [item, ...this.items];

    const overflow = next.slice(MAX_VISIBLE);
    for (const o of overflow) this.#clearTimer(o.id);
    this.items = next.slice(0, MAX_VISIBLE);

    if (payload.duration > 0) this.#scheduleRemoval(payload.id, payload.duration);
  }

  #updateProgress(payload: ToastProgressUpdatePayload) {
    this.items = this.items.map((t) =>
      t.id === payload.id ? { ...t, progress: payload.progress, message: payload.message ?? t.message } : t,
    );
  }

  #finishProgress(payload: ToastProgressDonePayload) {
    const now = Date.now();
    this.items = this.items.map((t) =>
      t.id === payload.id
        ? {
            ...t,
            variant: payload.variant,
            message: payload.message,
            progress: undefined,
            duration: payload.duration,
            createdAt: now,
            remaining: payload.duration,
          }
        : t,
    );

    if (payload.duration > 0 && this.items.some((t) => t.id === payload.id)) {
      this.#scheduleRemoval(payload.id, payload.duration);
    }
  }

  // ---

  dismiss = (id: number) => {
    this.#clearTimer(id);
    this.items = this.items.filter((t) => t.id !== id);
  };

  handleContainerMouseEnter = () => {
    this.layout.hoverSpring.set(1).catch(() => {});
    this.#pauseAll();
  };

  handleContainerMouseLeave = () => {
    this.layout.hoverSpring.set(0).catch(() => {});
    if (!this.historyOpen) this.#resumeAll();
  };

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
      this.dismiss(id);
    }, delay);
    this.#timers.set(id, handle);
  }

  #pauseAll() {
    const now = Date.now();
    for (const [, handle] of this.#timers) clearTimeout(handle);
    this.#timers.clear();

    this.items = this.items.map((t) => {
      if (t.duration <= 0) return t;
      const elapsed = now - t.createdAt;
      return { ...t, remaining: Math.max(0, t.remaining - elapsed) };
    });
  }

  #resumeAll() {
    const now = Date.now();
    this.items = this.items.map((t) => {
      if (t.duration <= 0) return t;
      this.#scheduleRemoval(t.id, t.remaining);
      return { ...t, createdAt: now };
    });
  }
}
