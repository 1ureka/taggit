import { goto } from "$app/navigation";
import { isInEditable } from "$lib/client/dom.js";
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

  /** 名稱驗證錯誤訊息 */
  let nameError = $state("");

  // ---

  /** 執行儲存變更至伺服器 */
  async function saveChanges() {
    const img = ctx.image;
    if (!img || !ctx.dirty || ctx.loading) return;
    ctx.loading = true;

    if (ctx.saveTimer) clearTimeout(ctx.saveTimer);

    try {
      const res = await api.patch<ImageWithId>(`/api/images/${encodeURIComponent(img.id)}`, {
        tags: img.tags,
        rating: img.rating,
        name: img.name,
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
      ctx.loading = false;
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

  /** 驗證名稱格式，回傳錯誤訊息或空字串 */
  function validateName(value: string): string {
    if (value.trim().length === 0) return "名稱不可為空白";
    if (value.length > 200) return "名稱不可超過 200 字元";
    return "";
  }

  // ---

  /** 監聽 dirty 狀態變化，自動觸發 debounce 儲存 */
  $effect(() => {
    if (ctx.dirty) {
      debouncedSave();
    }
  });

  // ---

  /** 顯示確認對話框並等待使用者回應 */
  function confirmDialog(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      ctx.pendingConfirm = { message, resolve };
    });
  }

  /** 將圖片移入垃圾桶 */
  async function doTrash() {
    const img = ctx.image;
    if (!img || ctx.loading) return;
    const ok = await confirmDialog("確定要將此圖片移入垃圾桶嗎？");
    if (!ok) return;

    ctx.loading = true;
    try {
      const res = await api.del(`/api/images/${encodeURIComponent(img.id)}`);
      if (!res.ok) {
        addToast("操作失敗: " + (res.error || "未知錯誤"), "error");
        return;
      }
      addToast("已移入垃圾桶", "success");
      goto("/editor");
    } finally {
      ctx.loading = false;
    }
  }

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

  /** 處理名稱輸入框失焦事件，驗證名稱並標記變更 */
  function handleNameBlur(e: FocusEvent) {
    const input = e.target as HTMLInputElement;
    const value = input.value;
    const error = validateName(value);
    nameError = error;
    if (!error && ctx.image && value !== ctx.image.name) {
      ctx.image.name = value;
      markDirty();
    }
  }

  /** 處理名稱輸入框鍵盤事件，Enter 時觸發失焦以確認變更 */
  function handleNameKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  }

  // ---

  /** 處理儲存按鈕點擊事件，立即儲存變更 */
  function handleSaveClick() {
    saveChanges();
  }

  /** 處理刪除按鈕點擊事件，確認後將圖片移入垃圾桶 */
  function handleTrashClick() {
    doTrash();
  }

  // ---

  /** 處理 Window 鍵盤事件，執行儲存與導航快捷鍵操作 */
  function handleWindowKeydown(e: KeyboardEvent) {
    const inInput = isInEditable(e.target);

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
    /** 存取是否有未儲存變更的 getter */
    get dirty() {
      return ctx.dirty;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return ctx.loading;
    },
    /** 存取名稱驗證錯誤訊息的 getter */
    get nameError() {
      return nameError;
    },

    /** 處理評等變更事件，標記為已變更 */
    handleRatingChange,
    /** 處理標籤變更事件，標記為已變更 */
    handleTagChange,
    /** 處理名稱輸入框失焦事件，驗證名稱並標記變更 */
    handleNameBlur,
    /** 處理名稱輸入框鍵盤事件，Enter 時觸發失焦以確認變更 */
    handleNameKeydown,
    /** 處理儲存按鈕點擊事件，立即儲存變更 */
    handleSaveClick,
    /** 處理刪除按鈕點擊事件，確認後將圖片移入垃圾桶 */
    handleTrashClick,
    /** 處理 Window 鍵盤事件，執行儲存與導航快捷鍵操作 */
    handleWindowKeydown,
  };
}
