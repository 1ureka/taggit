import { invalidateAll } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast, requestConfirm } from "$lib/client/dom.js";

/**
 * EditorSelectionDock 的配置選項
 */
type EditorSelectionDockOptions = {
  /** 雙向綁定：已選取的圖片 ID 集合 */
  selected: Set<string>;
};

/**
 * 建立批次操作面板邏輯的核心工廠函數
 */
export function createEditorSelectionDock(options: EditorSelectionDockOptions) {
  /** 已選取的圖片數量 */
  const count = $derived(options.selected.size);
  /** 是否正在執行批次操作 */
  let loading = $state(false);

  // ---

  /** 清除所有選取 */
  function clearSelection() {
    options.selected = new Set();
  }

  // ---

  /** 處理關閉按鈕點擊事件，清除所有選取 */
  function handleCloseClick() {
    clearSelection();
  }

  /** 處理刪除按鈕點擊事件，批次刪除已選取的圖片 */
  async function handleDeleteClick() {
    if (loading) return;
    const ids = [...options.selected];
    if (ids.length === 0) return;

    const ok = await requestConfirm(`確定要刪除已選取的 ${ids.length} 張圖片嗎？此操作無法復原。`);
    if (!ok) return;

    loading = true;
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const res = await api.del(`/api/images/${encodeURIComponent(id)}`);
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    await invalidateAll(); // 其會觸發 load 重新讀取圖片列表，從而觸發 +page.svelte 的驗證選取邏輯

    if (failCount > 0) addToast(`已刪除 ${successCount} 張，${failCount} 張失敗`, "error");
    else addToast(`已刪除 ${successCount} 張圖片`, "success");

    loading = false;
  }

  /** 處理退回按鈕點擊事件（空殼，後續實作） */
  async function handleUnstageClick() {
    // 後續實作：committed → staged
  }

  // ---

  return {
    /** 存取已選取數量的 getter */
    get count() {
      return count;
    },
    /** 存取批次操作載入狀態的 getter */
    get loading() {
      return loading;
    },

    /** 處理關閉按鈕點擊事件，清除所有選取 */
    handleCloseClick,
    /** 處理刪除按鈕點擊事件，批次刪除已選取的圖片 */
    handleDeleteClick,
    /** 處理退回按鈕點擊事件（空殼，後續實作） */
    handleUnstageClick,
  };
}
