import { invalidateAll } from "$app/navigation";
import { batchRun } from "$lib/utils.js";
import { api } from "$lib/client/api.js";
import { addToast, isInEditable, requestConfirm } from "$lib/client/dom.js";
import { tagCache } from "$lib/client/cache.js";
import type { ImageHeader, ImageWithId } from "$lib/types.js";

/**
 * EditorForm 的配置選項
 */
type EditorFormOptions = {
  /** 唯讀：SSR 回傳的已提交檔案列表 */
  get committedFiles(): ImageHeader[];
  /** 唯讀：SSR 回傳的當前圖片記錄 */
  get currentRecord(): ImageWithId | null;
  /** 唯讀：已選取的檔案 id 集合 */
  get selectedFiles(): Set<string>;
  /** 雙向綁定：操作狀態 (共用鎖) */
  get pending(): boolean;
  set pending(v: boolean);
};

/**
 * EditorForm 的互動邏輯
 */
export class EditorForm {
  /** 是否編輯過 */
  dirty = $state(false);
  /** 名稱 */
  name = $state("");
  /** 標籤列表 */
  tags = $state<string[]>([]);
  /** 評等 0–5 */
  rating = $state(0);
  /** 多選時名稱欄位是否 disabled */
  nameDisabled: boolean;
  /** 提交按鈕是否 disabled */
  saveDisabled: boolean;
  /** 刪除按鈕是否 disabled */
  deleteDisabled: boolean;

  constructor(private options: EditorFormOptions) {
    this.nameDisabled = $derived(options.selectedFiles.size > 1);

    this.saveDisabled = $derived.by(() => {
      if (!this.dirty) return true;
      if (this.options.currentRecord === null) return true;
      if (this.options.pending) return true;
      if (this.options.selectedFiles.size === 0) return true;
      if (this.tags.length === 0) return true;
      return false;
    });

    this.deleteDisabled = $derived.by(() => {
      if (this.options.currentRecord === null) return true;
      if (this.options.pending) return true;
      if (this.options.selectedFiles.size === 0) return true;
      return false;
    });

    // 初始化表單
    this.#resetForm();

    // currentRecord 變動時同步表單
    $effect(() => {
      this.#resetForm();
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

    this.dirty = false;
  }

  /** 存檔已選取的圖片 */
  async #doSave() {
    if (this.saveDisabled) return;

    const isMulti = this.options.selectedFiles.size > 1;
    if (isMulti) {
      const n = this.options.selectedFiles.size;
      if (!(await requestConfirm(`確定要將當前設定覆蓋到選取的 ${n} 張圖片？（名稱不會被覆蓋）`))) return;
    }

    this.options.pending = true;
    const records: ImageHeader[] = [];
    const fileMap = new Map(this.options.committedFiles.map((rec) => [rec.id, rec]));

    for (const id of this.options.selectedFiles) {
      const rec = fileMap.get(id);
      if (rec) {
        records.push(rec);
      } else {
        return addToast(`未找到圖片 ${id} 的紀錄`, "error");
      }
    }

    try {
      const [ok, fail] = await batchRun(records, 5, async (record) => {
        const patch: Record<string, unknown> = {
          tags: this.tags,
          rating: this.rating,
          expectedUpdatedAt: record.updatedAt,
        };

        if (!isMulti) {
          patch.name = this.name; // 單選時才更新名稱
        }

        return api.patch(`/api/committed/${encodeURIComponent(record.id)}`, patch);
      });

      if (ok) addToast(ok === 1 ? `已存檔: ${records[0].id}` : `已存檔 ${ok} 張圖片`, "success");
      if (fail) addToast(`${fail} 張存檔失敗`, "error");

      tagCache.invalidate();
      await invalidateAll();
    } finally {
      this.options.pending = false;
    }
  }

  /** 刪除已選取的圖片（取消提交，回到 staged） */
  async #doDelete() {
    if (this.deleteDisabled) return;

    const n = this.options.selectedFiles.size;
    const msg =
      n === 1 ? `確定要取消提交 ${[...this.options.selectedFiles][0]}？` : `確定要取消提交選取的 ${n} 張圖片？`;
    const desc = "此操作會將圖片包括名稱的所有屬性刪除，圖片本身則回到暫存區";
    if (!(await requestConfirm(`${msg}（${desc}）`, { title: "取消提交", action: "取消提交" }))) return;

    const ids = [...this.options.selectedFiles];
    this.options.pending = true;

    try {
      const [ok, fail] = await batchRun(ids, 5, (id) => api.del(`/api/committed/${encodeURIComponent(id)}`));

      if (ok) addToast(ok === 1 ? `已取消提交: ${ids[0]}` : `已取消提交 ${ok} 張圖片`, "info");
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

  /** 處理表單編輯事件 */
  handleFieldChange = () => {
    this.dirty = true;
  };
}
