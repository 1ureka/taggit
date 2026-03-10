import type { QueryResult } from "$lib/types.js";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/dom.js";
import { getEditorContext } from "./context.svelte.js";

/**
 * 建立批次操作面板邏輯的核心工廠函數
 */
export function createEditorSelectionDock() {
  /** Editor 頁面共享的 Context */
  const ctx = getEditorContext();

  // ---

  /** 已選取的圖片數量 */
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
    }
  }

  /** 清除所有選取 */
  function clearSelection() {
    ctx.selected = new Set();
  }

  /** 顯示確認對話框並等待使用者回應 */
  function confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      ctx.pendingConfirm = { message, resolve };
    });
  }

  // ---

  /** 處理關閉按鈕點擊事件，清除所有選取 */
  function handleCloseClick() {
    clearSelection();
  }

  /** 處理刪除按鈕點擊事件，批次刪除已選取的圖片 */
  async function handleDeleteClick() {
    const ids = [...ctx.selected];
    if (ids.length === 0) return;

    const ok = await confirmDialog(`確定要刪除已選取的 ${ids.length} 張圖片嗎？此操作無法復原。`);
    if (!ok) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const res = await api.del(`/api/images/${encodeURIComponent(id)}`);
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
      addToast(`已刪除 ${successCount} 張圖片`, "success");
    }
  }

  /** 處理評等變更事件，批次設定已選取圖片的評等 */
  async function handleRatingChange(rating: number) {
    const ids = [...ctx.selected];
    if (ids.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      const image = ctx.items.find((item) => item.id === id);
      if (!image) {
        failCount++;
        continue;
      }
      const res = await api.patch<{ updatedAt?: number }>(`/api/images/${encodeURIComponent(id)}`, {
        rating,
        expectedUpdatedAt: image.updatedAt,
      });
      if (res.ok) {
        successCount++;
        ctx.items = ctx.items.map((item) =>
          item.id === id ? { ...item, rating, updatedAt: res.data?.updatedAt ?? item.updatedAt } : item,
        );
      } else {
        failCount++;
      }
    }

    if (failCount > 0) {
      addToast(`已設定 ${successCount} 張，${failCount} 張失敗`, "error");
    } else {
      addToast(`已設定 ${successCount} 張圖片為 ${rating} 星`, "success");
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
    /** 處理刪除按鈕點擊事件，批次刪除已選取的圖片 */
    handleDeleteClick,
    /** 處理評等變更事件，批次設定已選取圖片的評等 */
    handleRatingChange,
  };
}
