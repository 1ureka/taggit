import { api } from "$lib/client/api.js";
import { addToast, requestConfirm } from "$lib/client/dom.js";
import { getTrashContext } from "./context.svelte.js";

/**
 * 建立搜尋表單邏輯的核心工廠函數
 */
export function createTrashForm() {
  /** Trash 頁面共享的 Context */
  const ctx = getTrashContext();

  // ---

  /** 執行伺服器查詢並更新 Context 狀態 */
  async function doSearch() {
    ctx.page = 1;
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

  /** 處理搜尋輸入框 input 事件，以 debounce 方式觸發查詢 */
  function handleSearchInput() {
    if (ctx.searchTimer) clearTimeout(ctx.searchTimer);
    ctx.searchTimer = setTimeout(() => doSearch(), ctx.SEARCH_DEBOUNCE);
  }

  /** 處理還原全部按鈕點擊事件，還原垃圾桶中的所有圖片 */
  async function handleRestoreAllClick() {
    const ok = await requestConfirm("確定要還原垃圾桶中的所有圖片嗎？它們會被移回待審查區。");
    if (!ok) return;

    const res = await api.post<{ restored: number }>("/api/trash");
    if (res.ok) {
      addToast(`已還原 ${res.data?.restored ?? 0} 張圖片`, "success");
    } else {
      addToast("還原失敗: " + (res.error ?? "未知錯誤"), "error");
    }

    ctx.selected = new Set();
    await doSearch();
  }

  /** 處理清空按鈕點擊事件，永久刪除垃圾桶中的所有圖片 */
  async function handleEmptyTrashClick() {
    const ok = await requestConfirm("確定要清空整個垃圾桶嗎？所有圖片將被永久刪除，此操作無法復原。");
    if (!ok) return;

    const res = await api.del<{ deleted: number }>("/api/trash");
    if (res.ok) {
      addToast(`已清空垃圾桶 (${res.data?.deleted ?? 0} 張)`, "success");
    } else {
      addToast("清空失敗: " + (res.error ?? "未知錯誤"), "error");
    }

    ctx.selected = new Set();
    await doSearch();
  }

  // ---

  return {
    /** 處理搜尋輸入框 input 事件，以 debounce 方式觸發查詢 */
    handleSearchInput,
    /** 處理還原全部按鈕點擊事件，還原垃圾桶中的所有圖片 */
    handleRestoreAllClick,
    /** 處理清空按鈕點擊事件，永久刪除垃圾桶中的所有圖片 */
    handleEmptyTrashClick,
  };
}
