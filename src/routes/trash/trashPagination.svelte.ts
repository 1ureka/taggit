import { api } from "$lib/client/api.js";
import { getTrashContext } from "./context.svelte.js";

/**
 * 建立分頁邏輯的核心工廠函數
 */
export function createTrashPagination() {
  /** Trash 頁面共享的 Context */
  const ctx = getTrashContext();

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
      if (ctx.searchText.trim()) params.set("search", ctx.searchText.trim());

      const res = await api.get<{ files: string[]; total: number; page: number; pages: number }>(
        `/api/trash?${params.toString()}`,
      );
      if (res.ok && res.data) {
        ctx.files = res.data.files;
        ctx.total = res.data.total;
        ctx.pages = res.data.pages;
      }
    } finally {
      ctx.loading = false;
      if (ctx.loadingTimer) clearTimeout(ctx.loadingTimer);
      ctx.showLoading = false;
      validateSelection();
    }
  }

  /** 清除已不在當前結果中的已選取檔案 */
  function validateSelection() {
    if (ctx.selected.size === 0) return;
    const visible = new Set(ctx.files);
    const next = new Set([...ctx.selected].filter((f) => visible.has(f)));
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
