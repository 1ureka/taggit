import { invalidateAll } from "$app/navigation";
import type { ImageWithId } from "$lib/types.js";
import type { EditorForm } from "./editorForm.svelte.js";

import { api } from "$lib/client/api.js";
import { batchRun } from "$lib/utils.js";
import { addToast, isInEditable, requestConfirm } from "$lib/client/dom.js";
import { tagCache } from "$lib/client/cache.js";

/**
 * 編輯操作的配置選項
 */
type EditorFormActionsOptions = {
  /** 唯讀，編輯表單狀態實例 */
  get form(): EditorForm;
  /** 唯讀，SSR 回傳的已提交檔案列表 */
  get committedFiles(): ImageWithId[];
  /** 唯讀，SSR 回傳的當前圖片記錄 */
  get currentRecord(): ImageWithId | null;
  /** 唯讀，當前選取的檔案列表 */
  get selectedFiles(): Set<string>;
  /** 雙向綁定，操作狀態 (全局鎖) */
  get pending(): boolean;
  set pending(v: boolean);
};

/**
 * 編輯操作的互動邏輯
 */
export class EditorFormActions {
  nameDisabled: boolean;
  /** 是否可以儲存 */
  saveDisabled: boolean;
  /** 是否可以刪除 */
  deleteDisabled: boolean;

  constructor(private options: EditorFormActionsOptions) {
    this.nameDisabled = $derived(options.selectedFiles.size > 1);

    this.saveDisabled = $derived.by(() => {
      const { form, currentRecord, pending, selectedFiles } = this.options;

      if (!form.dirty) return true;
      if (currentRecord === null) return true;
      if (pending) return true;
      if (selectedFiles.size === 0) return true;
      if (form.tags.length === 0) return true;
      return false;
    });

    this.deleteDisabled = $derived.by(() => {
      const { currentRecord, pending, selectedFiles } = this.options;

      if (currentRecord === null) return true;
      if (pending) return true;
      if (selectedFiles.size === 0) return true;
      return false;
    });
  }

  // ---

  /** 存檔已選取的圖片 */
  async #doSave() {
    if (this.saveDisabled) return;

    const { form, committedFiles, selectedFiles } = this.options;
    const isMulti = selectedFiles.size > 1;

    if (isMulti) {
      const n = selectedFiles.size;
      if (!(await requestConfirm(`確定要將當前設定覆蓋到選取的 ${n} 張圖片？（名稱不會被覆蓋）`))) return;
    }

    this.options.pending = true;
    const records: ImageWithId[] = [];
    const fileMap = new Map(committedFiles.map((rec) => [rec.id, rec]));

    for (const id of selectedFiles) {
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
          tags: form.tags,
          rating: form.rating,
          expectedUpdatedAt: record.updatedAt,
        };

        if (!isMulti) {
          patch.name = form.name;
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

  /** 退回已選取的圖片 */
  async #doDelete() {
    if (this.deleteDisabled) return;

    const { selectedFiles } = this.options;
    const n = selectedFiles.size;
    const ids = [...selectedFiles];

    const msg = n === 1 ? `確定要取消提交 ${ids[0]}？` : `確定要取消提交選取的 ${n} 張圖片？`;
    const desc = "此操作會將圖片包括名稱的所有屬性刪除，圖片本身則回到暫存區";
    if (!(await requestConfirm(`${msg}（${desc}）`, { title: "取消提交", action: "取消提交" }))) return;

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

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      this.#doSave();
      return;
    }

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
    this.options.form.reset();
  };
}
