import { invalidateAll } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast, requestConfirm } from "$lib/client/dom.js";

/**
 * TrashSelectionDock 的配置選項
 */
type TrashSelectionDockOptions = {
  /** 雙向綁定：已選取的檔案名稱集合 */
  selected: Set<string>;
};

/**
 * 建立批次操作面板邏輯的核心工廠函數
 */
export function createTrashSelectionDock(options: TrashSelectionDockOptions) {
  /** 已選取的檔案數量 */
  const count = $derived(options.selected.size);

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

  /** 處理還原按鈕點擊事件，批次還原已選取的檔案 */
  async function handleRestoreClick() {
    const filenames = [...options.selected];
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

    await invalidateAll();
    clearSelection();

    if (failCount > 0) {
      addToast(`已還原 ${successCount} 張，${failCount} 張失敗`, "error");
    } else {
      addToast(`已還原 ${successCount} 張圖片`, "success");
    }
  }

  /** 處理刪除按鈕點擊事件，批次永久刪除已選取的檔案 */
  async function handleDeleteClick() {
    const filenames = [...options.selected];
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

    await invalidateAll();
    clearSelection();

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
