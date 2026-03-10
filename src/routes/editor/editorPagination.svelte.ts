import { api } from "$lib/client/api.js";
import type { QueryResult } from "$lib/types.js";
import { getEditorContext } from "./context.svelte.js";

/**
 * 建立分頁邏輯的核心工廠函數
 */
export function createEditorPagination() {
  /** Editor 頁面共享的 Context */
  const ctx = getEditorContext();

  // ---

  /** 執行伺服器查詢（不重置頁碼）並更新 Context 狀態 */
  async function doSearch() {
    ctx.loading = true;

    if (ctx.loadingTimer) clearTimeout(ctx.loadingTimer);
    ctx.loadingTimer = setTimeout(() => {
      if (ctx.loading) ctx.showLoading = true;
    }, ctx.LOADING_DELAY);

    try {
      const params = new URLSearchParams();
      params.set("limit", String(ctx.PAGE_SIZE));
      params.set("page", String(ctx.page));
      params.set("sort", ctx.sort);
      params.set("order", ctx.order);
      if (ctx.searchText.trim()) params.set("search", ctx.searchText.trim());
      if (ctx.selectedTags.length > 0) params.set("tags", ctx.selectedTags.join(","));
      if (ctx.rating !== undefined) {
        params.set("rating", String(ctx.rating));
        params.set("ratingOp", ctx.ratingOp);
      }

      const res = await api.get<QueryResult>(`/api/images?${params.toString()}`);
      if (res.ok && res.data) {
        ctx.items = res.data.items;
        ctx.total = res.data.total;
        ctx.page = res.data.page;
        ctx.pages = res.data.pages;
      }
    } finally {
      ctx.loading = false;
      if (ctx.loadingTimer) clearTimeout(ctx.loadingTimer);
      ctx.showLoading = false;
      validateSelection();
    }
  }

  /** 清除已不在當前結果中的已選取 ID */
  function validateSelection() {
    if (ctx.selected.size === 0) return;
    const visibleIds = new Set(ctx.items.map((item) => item.id));
    const next = new Set([...ctx.selected].filter((id) => visibleIds.has(id)));
    if (next.size !== ctx.selected.size) {
      ctx.selected = next;
    }
  }

  // ---

  /** 處理頁碼按鈕點擊事件，切換至指定頁碼並查詢 */
  function handlePageClick(p: number) {
    if (p < 1 || p > ctx.pages) return;
    ctx.page = p;
    doSearch();
  }

  // ---

  return {
    /** 處理頁碼按鈕點擊事件，切換至指定頁碼並查詢 */
    handlePageClick,
  };
}
