import { getTaggerContext } from "./context.svelte.js";
import { scrollToActive } from "./helpers.js";

/**
 * 建立虛擬列表邏輯的核心工廠函數
 */
export function createTaggerList() {
  /** Tagger 頁面共享的 Context */
  const ctx = getTaggerContext();

  /** Shift 多選的錨點索引（不在 ctx 中） */
  let anchor = 0;

  /** 虛擬列表渲染緩衝區大小 */
  const BUFFER = 5;

  /** 捲動容器目前的 scrollTop */
  let scrollTop = $state(0);
  /** 捲動容器可見高度 */
  let viewH = $state(400);

  /** 虛擬列表內容總高度 */
  const totalH = $derived(ctx.list.length * ctx.ITEM_H);
  /** 可見範圍的起始索引（含緩衝區） */
  const startIdx = $derived(Math.max(0, Math.floor(scrollTop / ctx.ITEM_H) - BUFFER));
  /** 可見範圍的結束索引（含緩衝區） */
  const endIdx = $derived(Math.min(ctx.list.length, Math.ceil((scrollTop + viewH) / ctx.ITEM_H) + BUFFER));
  /** 可見的項目列表 */
  const visible = $derived(
    ctx.list.slice(startIdx, endIdx).map((filename, i) => ({
      filename,
      index: startIdx + i,
    })),
  );

  // ---

  /** 透過 ResizeObserver 追蹤列表容器高度 */
  $effect(() => {
    if (!ctx.listEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) viewH = e.contentRect.height;
    });
    ro.observe(ctx.listEl);
    return () => ro.disconnect();
  });

  // ---

  /** 以單選模式選取指定索引 */
  function selectSingle(idx: number) {
    ctx.cursor = idx;
    ctx.selected = new Set([idx]);
    anchor = idx;
    ctx.tags = [];
    ctx.rating = 0;
    scrollToActive(ctx.listEl, idx, ctx.ITEM_H);
    ctx.zoomPan?.reset();
  }

  /** 以 Ctrl 模式切換指定索引的選取狀態 */
  function selectCtrl(idx: number) {
    const next = new Set(ctx.selected);
    next.has(idx) && next.size > 1 ? next.delete(idx) : next.add(idx);
    ctx.cursor = idx;
    ctx.selected = next;
    anchor = idx;
    scrollToActive(ctx.listEl, idx, ctx.ITEM_H);
    ctx.zoomPan?.reset();
  }

  /** 以 Shift 模式選取錨點到指定索引的範圍 */
  function selectShift(idx: number) {
    const lo = Math.min(anchor, idx);
    const hi = Math.max(anchor, idx);
    const next = new Set<number>();
    for (let i = lo; i <= hi; i++) next.add(i);
    ctx.cursor = idx;
    ctx.selected = next;
    scrollToActive(ctx.listEl, idx, ctx.ITEM_H);
    ctx.zoomPan?.reset();
  }

  // ---

  /** 處理列表項目點擊事件，根據修飾鍵執行對應的選取模式 */
  function handleItemClick(e: MouseEvent, idx: number) {
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";
    if (mode === "single") selectSingle(idx);
    else if (mode === "ctrl") selectCtrl(idx);
    else selectShift(idx);
  }

  /** 處理列表捲動事件，同步 scrollTop 狀態 */
  function handleListScroll() {
    if (ctx.listEl) scrollTop = ctx.listEl.scrollTop;
  }

  // ---

  return {
    /** 存取虛擬列表內容總高度的 getter */
    get totalH() {
      return totalH;
    },
    /** 存取可見項目列表的 getter */
    get visible() {
      return visible;
    },

    /** 處理列表項目點擊事件，根據修飾鍵執行對應的選取模式 */
    handleItemClick,
    /** 處理列表捲動事件，同步 scrollTop 狀態 */
    handleListScroll,
  };
}
