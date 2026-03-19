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
 * EditorSelectionDock 的互動邏輯
 */
export class EditorSelectionDock {
  /** 已選取的圖片數量 */
  count: number;
  /** 是否正在執行批次操作 */
  loading = $state(false);

  constructor(private options: EditorSelectionDockOptions) {
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

  /** 處理退回按鈕點擊事件，批次將已選取的圖片退回暫存區 */
  handleDeleteClick = async () => {
    if (this.loading) return;

    const ids = [...this.options.selected];
    if (ids.length === 0) return;

    const ok = await requestConfirm(`確定要將已選取的 ${ids.length} 張圖片退回暫存區嗎？`);
    if (!ok) return;

    this.loading = true;
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

    await invalidateAll();
    this.#clearSelection();
    this.loading = false;

    if (failCount > 0) {
      addToast(`已退回 ${successCount} 張，${failCount} 張失敗`, "error");
    } else {
      addToast(`已退回 ${successCount} 張圖片至暫存區`, "success");
    }
  };
}
