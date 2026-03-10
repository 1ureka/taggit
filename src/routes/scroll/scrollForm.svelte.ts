import type { QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/dom.js";
import { getScrollContext } from "./context.svelte.js";

/**
 * 建立篩選表單邏輯的核心工廠函數
 */
export function createScrollForm() {
  /** Scroll 頁面共享的 Context */
  const ctx = getScrollContext();

  // ---

  /** 執行伺服器查詢並更新 Context 狀態 */
  async function doSearch() {
    ctx.loading = true;

    try {
      const params = new URLSearchParams();
      params.set("sort", ctx.sort);
      params.set("order", ctx.order);
      if (ctx.selectedTags.length > 0) params.set("tags", ctx.selectedTags.join(","));
      if (ctx.rating !== undefined) {
        params.set("rating", String(ctx.rating));
        params.set("ratingOp", ctx.ratingOp);
      }

      const res = await api.get<QueryResult>(`/api/images?${params.toString()}`);
      if (res.ok && res.data) {
        ctx.items = res.data.items;
        ctx.total = res.data.total;
      } else {
        addToast(res.error || "載入失敗", "error");
      }
    } catch {
      addToast("載入失敗", "error");
    } finally {
      ctx.loading = false;
    }
  }

  // ---

  /** 處理篩選條件變更事件，立即觸發查詢 */
  function handleFilterChange() {
    doSearch();
  }

  // ---

  return {
    /** 處理篩選條件變更事件，立即觸發查詢 */
    handleFilterChange,
  };
}
