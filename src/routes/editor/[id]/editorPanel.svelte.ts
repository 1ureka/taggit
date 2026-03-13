import type { ImageWithId } from "$lib/types.js";
import { afterNavigate, goto, invalidateAll } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast, isInEditable, requestConfirm } from "$lib/client/dom.js";

const SAVE_DEBOUNCE = 800;

/**
 * EditorPanel 元件的配置選項
 */
type EditorPanelOptions = {
  /** 唯讀：SSR 回傳的圖片資料 */
  get image(): ImageWithId;
  /** 雙向綁定：操作載入狀態（頁面級共享） */
  get loading(): boolean;
  set loading(v: boolean);
};

/**
 * 建立編輯面板邏輯的核心工廠函數
 */
export function createEditorPanel(options: EditorPanelOptions) {
  // --- 可編輯欄位（各自 $state，由 afterNavigate 同步）

  /** 使用者可編輯的圖片名稱 */
  let name = $state(options.image.name);
  /** 使用者指派的標籤列表 */
  let tags = $state<string[]>([...options.image.tags]);
  /** 使用者評分 0–5 */
  let rating = $state(options.image.rating);

  // --- 內部狀態

  /** 是否有未儲存的變更 */
  let dirty = $state(false);
  /** 名稱驗證錯誤訊息 */
  let nameError = $state("");
  /** 自動儲存 debounce 計時器 */
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // --- afterNavigate：在所有導航完成時同步可編輯欄位
  afterNavigate(() => {
    name = options.image.name;
    tags = [...options.image.tags];
    rating = options.image.rating;
    dirty = false;
  });

  // ---

  /** 執行儲存變更至伺服器 */
  async function saveChanges() {
    if (!dirty || options.loading) return;
    options.loading = true;
    if (saveTimer) clearTimeout(saveTimer);

    try {
      const res = await api.patch<ImageWithId>(`/api/images/${encodeURIComponent(options.image.id)}`, {
        name,
        tags,
        rating,
        expectedUpdatedAt: options.image.updatedAt,
      });
      if (!res.ok) {
        if (res.status === 409) {
          addToast("儲存衝突：資料已被其他操作修改，正在重新載入", "error");
        } else {
          addToast("儲存失敗: " + (res.error || "未知錯誤"), "error");
        }
        await invalidateAll();
        return;
      }
      addToast("已儲存", "success");
      await invalidateAll();
    } finally {
      options.loading = false;
    }
  }

  /** 以 debounce 方式觸發自動儲存 */
  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveChanges(), SAVE_DEBOUNCE);
  }

  /** 標記資料為已變更並觸發 debounce 儲存 */
  function markDirty() {
    dirty = true;
    debouncedSave();
  }

  /** 驗證名稱格式，回傳錯誤訊息或空字串 */
  function validateName(value: string): string {
    if (value.trim().length === 0) return "名稱不可為空白";
    if (value.length > 200) return "名稱不可超過 200 字元";
    return "";
  }

  // ---

  /** 將圖片移入垃圾桶 */
  async function doTrash() {
    if (options.loading) return;
    const ok = await requestConfirm("確定要將此圖片移入垃圾桶嗎？");
    if (!ok) return;

    options.loading = true;
    try {
      const res = await api.del(`/api/images/${encodeURIComponent(options.image.id)}`);
      if (!res.ok) {
        addToast("操作失敗: " + (res.error || "未知錯誤"), "error");
        return;
      }
      addToast("已移入垃圾桶", "success");
      goto("/editor");
    } finally {
      options.loading = false;
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
    if (!error && value !== name) {
      name = value;
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
    /** 存取 SSR 圖片資料的 getter（唯讀欄位如 id、ext、metadata） */
    get image() {
      return options.image;
    },
    /** 存取可編輯名稱的 getter */
    get name() {
      return name;
    },
    /** 設定可編輯名稱的 setter */
    set name(v: string) {
      name = v;
    },
    /** 存取可編輯標籤的 getter */
    get tags() {
      return tags;
    },
    /** 設定可編輯標籤的 setter */
    set tags(v: string[]) {
      tags = v;
    },
    /** 存取可編輯評等的 getter */
    get rating() {
      return rating;
    },
    /** 設定可編輯評等的 setter */
    set rating(v: number) {
      rating = v;
    },
    /** 存取是否有未儲存變更的 getter */
    get dirty() {
      return dirty;
    },
    /** 存取載入狀態的 getter */
    get loading() {
      return options.loading;
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
