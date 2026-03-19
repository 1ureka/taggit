import type { ImageWithId } from "$lib/types.js";
import { goto, invalidateAll } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast, isInEditable, requestConfirm } from "$lib/client/dom.js";

/**
 * EditorForm 的配置選項
 */
type EditorFormOptions = {
  /** 唯讀：SSR 回傳的圖片資料 */
  image: ImageWithId;
  /** 雙向綁定：操作載入狀態（頁面級共享） */
  loading: boolean;
};

/**
 * EditorForm 的互動邏輯
 */
export class EditorForm {
  /** 使用者可編輯的圖片名稱 */
  name = $state("");
  /** 使用者指派的標籤列表 */
  tags = $state<string[]>([]);
  /** 使用者評分 0–5 */
  rating = $state(0);
  /** 是否有未儲存的變更 */
  dirty = $state(false);
  /** 名稱驗證錯誤訊息 */
  nameError = $state("");

  /** 自動儲存 debounce 計時器 */
  #saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private options: EditorFormOptions) {
    this.name = options.image.name;
    this.tags = [...options.image.tags];
    this.rating = options.image.rating;

    $effect(() => {
      this.name = options.image.name;
      this.tags = [...options.image.tags];
      this.rating = options.image.rating;
      this.dirty = false;
    });
  }

  // ---

  /** 執行儲存變更至伺服器 */
  async #saveChanges() {
    if (!this.dirty || this.options.loading) return;

    this.options.loading = true;
    if (this.#saveTimer) clearTimeout(this.#saveTimer);

    try {
      const res = await api.patch<ImageWithId>(`/api/images/${encodeURIComponent(this.options.image.id)}`, {
        name: this.name,
        tags: this.tags,
        rating: this.rating,
        expectedUpdatedAt: this.options.image.updatedAt,
      });

      if (res.ok) {
        addToast("已儲存", "success");
      } else if (res.status === 409) {
        addToast("儲存衝突：資料已被其他操作修改，正在重新載入", "error");
      } else {
        addToast("儲存失敗: " + (res.error || "未知錯誤"), "error");
      }

      await invalidateAll();
    } finally {
      this.options.loading = false;
    }
  }

  /** 標記資料為已變更並觸發 debounce 儲存 */
  #markDirty() {
    this.dirty = true;
    if (this.#saveTimer) clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.#saveChanges(), 800);
  }

  /** 驗證名稱格式，回傳錯誤訊息或空字串 */
  #validateName(value: string): string {
    if (value.trim().length === 0) return "名稱不可為空白";
    if (value.length > 200) return "名稱不可超過 200 字元";
    return "";
  }

  /** 將圖片移入垃圾桶 */
  async #doTrash() {
    if (this.options.loading) return;

    const ok = await requestConfirm("確定要將此圖片移入垃圾桶嗎？");
    if (!ok) return;

    this.options.loading = true;

    try {
      const res = await api.del(`/api/images/${encodeURIComponent(this.options.image.id)}`);

      if (!res.ok) {
        addToast("操作失敗: " + (res.error || "未知錯誤"), "error");
        return;
      }

      addToast("已移入垃圾桶", "success");
      goto("/editor");
    } finally {
      this.options.loading = false;
    }
  }

  // ---

  /** 處理評等變更事件，標記為已變更 */
  handleRatingChange = () => {
    this.#markDirty();
  };

  /** 處理標籤變更事件，標記為已變更 */
  handleTagChange = () => {
    this.#markDirty();
  };

  // ---

  /** 處理名稱輸入框失焦事件，驗證名稱並標記變更 */
  handleNameBlur = (e: FocusEvent) => {
    const input = e.target as HTMLInputElement;
    const value = input.value;
    const error = this.#validateName(value);
    this.nameError = error;
    if (!error && value !== this.name) {
      this.name = value;
      this.#markDirty();
    }
  };

  /** 處理名稱輸入框鍵盤事件，Enter 時觸發失焦以確認變更 */
  handleNameKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  // ---

  /** 處理儲存按鈕點擊事件，立即儲存變更 */
  handleSaveClick = () => {
    this.#saveChanges();
  };

  /** 處理刪除按鈕點擊事件，確認後將圖片移入垃圾桶 */
  handleTrashClick = () => {
    this.#doTrash();
  };

  // ---

  /** 處理 Window 鍵盤事件，執行儲存與導航快捷鍵操作 */
  handleWindowKeydown = (e: KeyboardEvent) => {
    const inInput = isInEditable(e.target);

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        this.#saveChanges();
      }
      return;
    }

    if (inInput || e.altKey) return;

    if (e.key === "Escape") {
      e.preventDefault();
      goto("/editor");
    }
  };
}
