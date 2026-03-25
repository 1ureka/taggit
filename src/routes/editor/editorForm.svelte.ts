import { invalidateAll } from "$app/navigation";
import { batchRun } from "$lib/utils.js";
import { api } from "$lib/client/api.js";
import { addToast, isInEditable, requestConfirm } from "$lib/client/dom.js";
import { tagCache } from "$lib/client/cache.js";
import type { ImageWithId } from "$lib/types.js";

/**
 * EditorForm 的配置選項
 */
type EditorFormOptions = {
  /** 唯讀：SSR 回傳的當前圖片記錄 */
  currentRecord: ImageWithId | null;
  /** 雙向綁定：已選取的檔名集合 */
  selectedFiles: Set<string>;
  /** 雙向綁定：操作狀態 (共用鎖) */
  pending: boolean;
};

/**
 * EditorForm 的互動邏輯
 */
export class EditorForm {
  /** 名稱 */
  name = $state("");
  /** 標籤列表 */
  tags = $state<string[]>([]);
  /** 評等 0–5 */
  rating = $state(0);
  /** 多選時名稱欄位是否 disabled */
  nameDisabled: boolean;

  constructor(private options: EditorFormOptions) {
    this.nameDisabled = $derived(options.selectedFiles.size > 1);

    // 初始化表單
    const rec = options.currentRecord;
    if (rec) {
      this.name = rec.name;
      this.tags = [...rec.tags];
      this.rating = rec.rating;
    }

    // currentRecord 變動時同步表單
    $effect(() => {
      const rec = options.currentRecord;
      if (rec) {
        this.name = rec.name;
        this.tags = [...rec.tags];
        this.rating = rec.rating;
      } else {
        this.name = "";
        this.tags = [];
        this.rating = 0;
      }
    });
  }

  // ---

  /** 重置表單為 currentRecord 的值 */
  #resetForm() {
    const rec = this.options.currentRecord;
    if (rec) {
      this.name = rec.name;
      this.tags = [...rec.tags];
      this.rating = rec.rating;
    } else {
      this.name = "";
      this.tags = [];
      this.rating = 0;
    }
  }

  /** 存檔已選取的圖片 */
  async #doSave() {
    if (this.options.pending || this.options.selectedFiles.size === 0) return;
    if (this.tags.length === 0) {
      addToast("請至少加入一個標籤才能存檔", "error");
      return;
    }

    const isMulti = this.options.selectedFiles.size > 1;

    if (isMulti) {
      const n = this.options.selectedFiles.size;
      if (!(await requestConfirm(`確定要將當前設定覆蓋到選取的 ${n} 張圖片？（名稱不會被覆蓋）`))) return;
    }

    const names = [...this.options.selectedFiles];
    this.options.pending = true;

    try {
      const [ok, fail] = await batchRun(names, 5, async (fn) => {
        // 先取得最新的 record 以獲得 expectedUpdatedAt
        const getRes = await api.get<ImageWithId>(`/api/committed/${encodeURIComponent(fn)}`);
        if (!getRes.ok || !getRes.data) return { ok: false };

        const patch: Record<string, unknown> = {
          tags: this.tags,
          rating: this.rating,
          expectedUpdatedAt: getRes.data.updatedAt,
        };

        // 單選時才更新名稱
        if (!isMulti) {
          patch.name = this.name;
        }

        return api.patch(`/api/committed/${encodeURIComponent(fn)}`, patch);
      });

      if (ok) {
        addToast(ok === 1 ? `已存檔: ${names[0]}` : `已存檔 ${ok} 張圖片`, "success");
      }
      if (fail) addToast(`${fail} 張存檔失敗`, "error");

      tagCache.invalidate();
      await invalidateAll();
    } finally {
      this.options.pending = false;
    }
  }

  /** 刪除已選取的圖片（取消提交，回到 staged） */
  async #doDelete() {
    if (this.options.pending || this.options.selectedFiles.size === 0) return;

    const n = this.options.selectedFiles.size;
    const msg =
      n === 1 ? `確定要取消提交 ${[...this.options.selectedFiles][0]}？` : `確定要取消提交選取的 ${n} 張圖片？`;
    if (!(await requestConfirm(msg))) return;

    const names = [...this.options.selectedFiles];
    this.options.pending = true;

    try {
      const [ok, fail] = await batchRun(names, 5, (fn) => api.del(`/api/committed/${encodeURIComponent(fn)}`));

      if (ok) {
        addToast(ok === 1 ? `已取消提交: ${names[0]}` : `已取消提交 ${ok} 張圖片`, "info");
      }
      if (fail) addToast(`${fail} 張刪除失敗`, "error");

      tagCache.invalidate();
      await invalidateAll();
    } finally {
      this.options.pending = false;
    }
  }

  // ---

  /** 處理 Window 鍵盤事件 */
  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;

    // Ctrl + S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      this.#doSave();
      return;
    }

    // Ctrl + D
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      this.#doDelete();
      return;
    }
  };

  // ---

  /** 處理表單提交事件 */
  handleFormSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    const button = e.submitter instanceof HTMLButtonElement ? e.submitter : null;
    const intent = button?.name === "intent" ? button.value : null;

    if (intent === "delete") {
      this.#doDelete();
    } else {
      this.#doSave();
    }
  };

  /** 處理表單重置事件 */
  handleFormReset = (e: Event) => {
    e.preventDefault();
    this.#resetForm();
  };
}
