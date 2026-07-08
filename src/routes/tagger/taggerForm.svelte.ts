import { invalidateAll } from "$app/navigation";
import { batchRun } from "$lib/utils/shared.js";
import { api } from "$lib/utils/client.js";
import { addToast, isInEditable, requestConfirm } from "$lib/components/dom.js";

/**
 * TaggerForm 的配置選項
 */
type TaggerFormOptions = {
  /** 雙向綁定：已選取的檔名集合 */
  selectedFiles: Set<string>;
  /** 雙向綁定：已處理數量 */
  progress: number;
};

/**
 * TaggerForm 的互動邏輯
 */
export class TaggerForm {
  /** 標籤列表 */
  tags = $state<string[]>([]);
  /** 評等 0–5 */
  rating = $state(0);
  /** 圖片名稱（僅在單選時生效；留空則沿用檔名） */
  name = $state("");
  /** 操作狀態（提交與刪除共用鎖） */
  pending = $state(false);

  /** 是否恰好選取一張圖片（多選時名稱欄位停用） */
  singleSelected: boolean;
  /** 名稱欄位的提示文字（依選取數量三態） */
  namePlaceholder: string;

  constructor(private options: TaggerFormOptions) {
    this.singleSelected = $derived(this.options.selectedFiles.size === 1);
    this.namePlaceholder = $derived.by(() => {
      const n = this.options.selectedFiles.size;
      if (n === 0) return "尚無圖片可命名";
      if (n > 1) return "多選時無法命名";
      return "圖片名稱（留空使用檔名）";
    });
  }

  // ---

  /** 重置表單 */
  #resetForm() {
    this.tags = [];
    this.rating = 0;
    this.name = "";
  }

  /** 提交已選取的圖片 */
  async #doCommit() {
    if (this.pending || this.options.selectedFiles.size === 0) return;
    if (this.tags.length === 0) {
      addToast("請至少加入一個標籤才能提交", "error");
      return;
    }

    if (this.options.selectedFiles.size > 1) {
      const n = this.options.selectedFiles.size;
      if (!(await requestConfirm(`確定要提交選取的 ${n} 張圖片？`))) return;
    }

    const names = [...this.options.selectedFiles];
    // name 只在單選時生效；多選時各檔案各自沿用檔名
    const customName = names.length === 1 ? this.name.trim() : "";
    this.pending = true;

    try {
      const [ok, fail] = await batchRun(names, 5, async (fn) => {
        return api.post(`/api/staged/${encodeURIComponent(fn)}`, {
          tags: this.tags,
          rating: this.rating,
          ...(customName ? { name: customName } : {}),
        });
      });

      if (ok) {
        addToast(ok === 1 ? `已提交: ${names[0]}` : `已提交 ${ok} 張圖片`, "success");
      }
      if (fail) addToast(`${fail} 張提交失敗`, "error");

      this.options.progress += ok;
      await invalidateAll();
    } finally {
      this.pending = false;
    }
  }

  /** 永久刪除已選取的圖片 */
  async #doDelete() {
    if (this.pending || this.options.selectedFiles.size === 0) return;

    const n = this.options.selectedFiles.size;
    const msg = `確定要永久刪除選取的 ${n} 張圖片？此操作無法復原。`;
    if (!(await requestConfirm(msg, { title: "永久刪除", action: "永久刪除" }))) return;

    const names = [...this.options.selectedFiles];
    this.pending = true;

    try {
      const [ok, fail] = await batchRun(names, 5, (fn) => api.del(`/api/staged/${encodeURIComponent(fn)}`));

      if (ok) {
        addToast(ok === 1 ? `已永久刪除: ${names[0]}` : `已永久刪除 ${ok} 張圖片`, "info");
      }
      if (fail) addToast(`${fail} 張刪除失敗`, "error");

      this.options.progress += ok;
      await invalidateAll();
    } finally {
      this.pending = false;
    }
  }

  // ---

  /** 處理 Window 鍵盤事件 */
  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;

    // Ctrl + S
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      this.#doCommit();
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
      this.#doCommit();
    }
  };

  /** 處理表單重置事件 */
  handleFormReset = (e: Event) => {
    e.preventDefault();
    this.#resetForm();
  };
}
