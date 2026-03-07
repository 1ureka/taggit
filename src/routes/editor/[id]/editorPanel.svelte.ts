import { goto } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast } from "$lib/client/toast.js";
import type { ImageWithId } from "$lib/types.js";
import { getEditorDetailContext } from "./context.svelte.js";

/**
 * 建立編輯面板邏輯的核心工廠函數
 */
export function createEditorPanel() {
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

  /** 以 debounce 方式觸發自動儲存 */
  function debouncedSave() {
    if (ctx.saveTimer) clearTimeout(ctx.saveTimer);
    ctx.saveTimer = setTimeout(() => saveChanges(), ctx.SAVE_DEBOUNCE);
  }

  /** 標記資料為已變更 */
  function markDirty() {
    ctx.dirty = true;
  }

  // ---

  /** 監聽 dirty 狀態變化，自動觸發 debounce 儲存 */
  $effect(() => {
    if (ctx.dirty) {
      debouncedSave();
    }
  });

  // ---

  /** 處理評等變更事件，標記為已變更 */
  function handleRatingChange() {
    markDirty();
  }

  /** 處理標籤變更事件，標記為已變更 */
  function handleTagChange() {
    markDirty();
  }

  // ---

  /** 處理 Window 鍵盤事件，執行儲存與導航快捷鍵操作 */
  function handleWindowKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        saveChanges();
      }
      return;
    }

    if (inInput || e.altKey) return;

    if (e.key === "Escape") {
      e.preventDefault();
      goto("/editor");
    }
  }

  // ---

  return {
    /** 處理評等變更事件，標記為已變更 */
    handleRatingChange,
    /** 處理標籤變更事件，標記為已變更 */
    handleTagChange,
    /** 處理 Window 鍵盤事件，執行儲存與導航快捷鍵操作 */
    handleWindowKeydown,
  };
}
