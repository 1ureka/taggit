import { getTaggerContext } from "./context.svelte.js";

/**
 * 建立進度列邏輯的核心工廠函數
 */
export function createTaggerProgress() {
  /** Tagger 頁面共享的 Context */
  const ctx = getTaggerContext();

  /** 已處理的圖片數量 */
  const processed = $derived(ctx.total - ctx.list.length);
  /** 進度百分比 */
  const progressPct = $derived(ctx.total > 0 ? Math.round((processed / ctx.total) * 100) : 0);
  /** 進度文字標籤 */
  const progressLabel = $derived(`${processed}/${ctx.total} (${ctx.list.length} 剩餘)`);

  // ---

  return {
    /** 存取已處理數量的 getter */
    get processed() {
      return processed;
    },
    /** 存取進度百分比的 getter */
    get progressPct() {
      return progressPct;
    },
    /** 存取進度文字標籤的 getter */
    get progressLabel() {
      return progressLabel;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return ctx.loading;
    },
  };
}
