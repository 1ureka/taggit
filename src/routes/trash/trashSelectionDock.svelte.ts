import { api } from "$lib/client/api.js";
import { addToast, requestConfirm } from "$lib/client/dom.js";
import { getTrashContext } from "./context.svelte.js";

/**
 * 建立批次操作面板邏輯的核心工廠函數
 */
export function createTrashSelectionDock() {
  /** Trash 頁面共享的 Context */
  const ctx = getTrashContext();

  // ---

  /** 已選取的檔案數量 */
  const count = $derived(ctx.selected.size);

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
    }
  }

  /** 清除所有選取 */
  function clearSelection() {
    ctx.selected = new Set();
  }

  // ---

  /** 處理關閉按鈕點擊事件，清除所有選取 */
  function handleCloseClick() {
    clearSelection();
  }

  /** 處理還原按鈕點擊事件，批次還原已選取的檔案 */
  async function handleRestoreClick() {
    const filenames = [...ctx.selected];
    if (filenames.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const f of filenames) {
      const res = await api.post(`/api/trash/${encodeURIComponent(f)}`);
      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    }

    clearSelection();
    await doSearch();

    if (failCount > 0) {
      addToast(`已還原 ${successCount} 張，${failCount} 張失敗`, "error");
    } else {
      addToast(`已還原 ${successCount} 張圖片`, "success");
    }
  }

  /** 處理刪除按鈕點擊事件，批次永久刪除已選取的檔案 */
  async function handleDeleteClick() {
    const filenames = [...ctx.selected];
    if (filenames.length === 0) return;

    const ok = await requestConfirm(`確定要永久刪除已選取的 ${filenames.length} 張圖片嗎？此操作無法復原。`);
    if (!ok) return;

    let successCount = 0;
    let failCount = 0;

    for (const f of filenames) {
      const res = await api.del(`/api/trash/${encodeURIComponent(f)}`);
      if (res.ok) {
        successCount++;
      } else {
        failCount++;
      }
    }

    clearSelection();
    await doSearch();

    if (failCount > 0) {
      addToast(`已刪除 ${successCount} 張，${failCount} 張失敗`, "error");
    } else {
      addToast(`已永久刪除 ${successCount} 張圖片`, "success");
    }
  }

  // ---

  return {
    /** 存取已選取數量的 getter */
    get count() {
      return count;
    },

    /** 處理關閉按鈕點擊事件，清除所有選取 */
    handleCloseClick,
    /** 處理還原按鈕點擊事件，批次還原已選取的檔案 */
    handleRestoreClick,
    /** 處理刪除按鈕點擊事件，批次永久刪除已選取的檔案 */
    handleDeleteClick,
  };
}
