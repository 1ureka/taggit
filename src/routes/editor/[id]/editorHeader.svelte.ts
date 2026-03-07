import { goto } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import type { ImageWithId } from "$lib/types.js";
import { getEditorDetailContext } from "./context.svelte.js";

/**
 * 建立編輯頁面標題列邏輯的核心工廠函數
 */
export function createEditorHeader() {
  /** Editor 詳細編輯頁面共享的 Context */
  const ctx = getEditorDetailContext();

  // ---

  /** 執行儲存變更至伺服器 */
  async function saveChanges() {
    const img = ctx.image;
    if (!img || !ctx.dirty || ctx.saving) return;
    ctx.saving = true;

    if (ctx.saveTimer) clearTimeout(ctx.saveTimer);

    try {
      const res = await api.patch<ImageWithId>(`/api/images/${encodeURIComponent(img.id)}`, {
        tags: img.tags,
        rating: img.rating,
        expectedUpdatedAt: img.updatedAt,
      });
      if (!res.ok) {
        if (res.status === 409) {
          addToast("儲存衝突：資料已被其他操作修改，正在重新載入", "error");
          await reloadImage();
        } else {
          addToast("儲存失敗: " + (res.error || "未知錯誤"), "error");
        }
        return;
      }
      if (res.data) {
        ctx.image = res.data;
      }
      ctx.dirty = false;
      addToast("已儲存", "success");
    } finally {
      ctx.saving = false;
    }
  }

  /** 從伺服器重新載入圖片資料 */
  async function reloadImage() {
    const img = ctx.image;
    if (!img) return;
    const res = await api.get<ImageWithId>(`/api/images/${encodeURIComponent(img.id)}`);
    if (res.ok && res.data) {
      ctx.image = res.data;
      ctx.dirty = false;
    }
  }

  /** 顯示確認對話框並等待使用者回應 */
  function confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      ctx.pendingConfirm = { message, resolve };
    });
  }

  // ---

  /** 處理儲存按鈕點擊事件，立即儲存變更 */
  function handleSaveClick() {
    saveChanges();
  }

  /** 處理刪除按鈕點擊事件，確認後將圖片移入垃圾桶 */
  async function handleTrashClick() {
    const img = ctx.image;
    if (!img) return;
    const ok = await confirmDialog("確定要將此圖片移入垃圾桶嗎？");
    if (!ok) return;

    const res = await api.del(`/api/images/${encodeURIComponent(img.id)}`);
    if (!res.ok) {
      addToast("操作失敗: " + (res.error || "未知錯誤"), "error");
      return;
    }
    addToast("已移入垃圾桶", "success");
    goto("/editor");
  }

  // ---

  return {
    /** 處理儲存按鈕點擊事件，立即儲存變更 */
    handleSaveClick,
    /** 處理刪除按鈕點擊事件，確認後將圖片移入垃圾桶 */
    handleTrashClick,
  };
}
