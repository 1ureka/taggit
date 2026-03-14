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
 * TrashSelectionDock 的互動邏輯
 */
export class TrashSelectionDock {
  /** 已選取的檔案數量 */
  count: number;
  /** 是否正在執行批次操作 */
  loading = $state(false);

  constructor(private options: TrashSelectionDockOptions) {
    this.count = $derived(options.selected.size);
  }

  // ---

  /** 清除所有選取 */
  #clearSelection() {
    this.options.selected = new Set();
  }

  // ---

  /** 處理關閉按鈕點擊事件，清除所有選取 */
  handleCloseClick = () => {
    this.#clearSelection();
  };

  /** 處理還原按鈕點擊事件，批次還原已選取的檔案 */
  handleRestoreClick = async () => {
    if (this.loading) return;

    const filenames = [...this.options.selected];
    if (filenames.length === 0) return;

    this.loading = true;
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
    this.#clearSelection();
    this.loading = false;

    if (failCount > 0) {
      addToast(`已還原 ${successCount} 張，${failCount} 張失敗`, "error");
    } else {
      addToast(`已還原 ${successCount} 張圖片`, "success");
    }
  };

  /** 處理刪除按鈕點擊事件，批次永久刪除已選取的檔案 */
  handleDeleteClick = async () => {
    if (this.loading) return;

    const filenames = [...this.options.selected];
    if (filenames.length === 0) return;

    const ok = await requestConfirm(`確定要永久刪除已選取的 ${filenames.length} 張圖片嗎？此操作無法復原。`);
    if (!ok) return;

    this.loading = true;
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
    this.#clearSelection();
    this.loading = false;

    if (failCount > 0) {
      addToast(`已刪除 ${successCount} 張，${failCount} 張失敗`, "error");
    } else {
      addToast(`已永久刪除 ${successCount} 張圖片`, "success");
    }
  };
}
