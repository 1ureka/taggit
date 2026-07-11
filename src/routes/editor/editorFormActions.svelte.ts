import { invalidateAll } from "$app/navigation";
import type { ImageWithId } from "$lib/database";
import type { EditorForm } from "./editorForm.svelte.js";
import type { EditorBatchForm } from "./editorBatchForm.svelte.js";

import { api } from "$lib/ui/request.js";
import { batchRun } from "$lib/utils/shared.js";
import { addToast, isInEditable, requestConfirm } from "$lib/ui/dom.js";

/**
 * 編輯操作的配置選項
 */
type EditorFormActionsOptions = {
  /** 唯讀，編輯表單狀態實例 */
  get form(): EditorForm;
  /** 唯讀，批次編輯表單狀態實例 */
  get batchForm(): EditorBatchForm;
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
  /** 是否為批次編輯模式 */
  isBatch: boolean;
  /** 是否可以儲存 */
  saveDisabled: boolean;
  /** 是否可以刪除 */
  deleteDisabled: boolean;

  constructor(private options: EditorFormActionsOptions) {
    this.isBatch = $derived(options.selectedFiles.size > 1);

    this.saveDisabled = $derived.by(() => {
      const { form, batchForm, currentRecord, pending, selectedFiles } = this.options;

      if (pending) return true;
      if (selectedFiles.size === 0) return true;

      if (this.isBatch) {
        return !batchForm.dirty;
      } else {
        if (!form.dirty) return true;
        if (currentRecord === null) return true;
        if (form.tags.length === 0) return true;
        return false;
      }
    });

    this.deleteDisabled = $derived.by(() => {
      const { currentRecord, pending, selectedFiles } = this.options;

      if (pending) return true;
      if (selectedFiles.size === 0) return true;
      if (currentRecord === null) return true;
      return false;
    });
  }

  // ---

  /** 存檔已選取的圖片 */
  async #doSave() {
    if (this.saveDisabled) return;

    this.options.pending = true;

    try {
      if (this.isBatch) {
        await this.#doSaveBatch();
      } else {
        await this.#doSaveSingle();
      }
    } finally {
      this.options.pending = false;
    }
  }

  /** 存檔單張圖片 */
  async #doSaveSingle() {
    const { form, currentRecord } = this.options;
    const record = currentRecord!;

    const res = await api.patch(`/api/committed/${encodeURIComponent(record.id)}`, {
      name: form.name,
      tags: form.tags,
      rating: form.rating,
      expectedUpdatedAt: record.updatedAt,
    });

    if (!res.ok) {
      const message = res.error ? `存檔失敗: ${res.error}` : "存檔失敗";
      addToast(message, "error");
    } else {
      addToast(`已存檔: ${record.id}`, "success");
    }

    await invalidateAll();
  }

  /** 批次存檔多張圖片 */
  async #doSaveBatch() {
    const { batchForm, committedFiles, selectedFiles } = this.options;
    const n = selectedFiles.size;
    if (!(await requestConfirm(`確定要批次更新選取的 ${n} 張圖片？`))) return;

    const fileMap = new Map(committedFiles.map((f) => [f.id, f]));

    const patches: { id: string; tags: string[]; updatedAt: number }[] = [];
    let skipped = 0;

    for (const id of selectedFiles) {
      const file = fileMap.get(id);
      if (!file) continue;

      const tagSet = new Set(file.tags);
      for (const t of batchForm.addTags) tagSet.add(t);
      for (const t of batchForm.removeTags) tagSet.delete(t);

      if (tagSet.size === 0) {
        skipped++;
      } else {
        patches.push({ id, tags: [...tagSet], updatedAt: file.updatedAt });
      }
    }

    if (skipped > 0) addToast(`由於會沒有標籤，已跳過 ${skipped} 張圖片`, "error");
    if (patches.length === 0) return;

    const [ok, fail] = await batchRun(patches, 5, async ({ id, tags, updatedAt }) => {
      const patch: Record<string, unknown> = { tags, expectedUpdatedAt: updatedAt };
      if (batchForm.ratingTouched) patch.rating = batchForm.rating;
      return api.patch(`/api/committed/${encodeURIComponent(id)}`, patch);
    });

    if (ok) addToast(`已更新 ${ok} 張圖片`, "success");
    if (fail) addToast(`${fail} 張更新失敗`, "error");

    await invalidateAll();
  }

  // ---

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
    if (this.isBatch) {
      this.options.batchForm.reset();
    } else {
      this.options.form.reset();
    }
  };
}
