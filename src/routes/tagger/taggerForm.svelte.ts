import { invalidateAll } from "$app/navigation";
import { batchRun } from "$lib/utils.js";
import { api } from "$lib/client/api.js";
import { addToast, isInEditable, requestConfirm } from "$lib/client/dom.js";
import { tagCache } from "$lib/client/cache.js";

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
  /** 標籤輸入框的容器 DOM 引用 */
  tagInputWrapEl = $state<HTMLDivElement>();
  /** 操作狀態（提交與刪除共用鎖） */
  pending = $state(false);

  constructor(private options: TaggerFormOptions) {}

  // ---

  /** 聚焦標籤輸入框 */
  #focusTagInput() {
    this.tagInputWrapEl?.querySelector("input")?.focus();
  }

  /** 重置表單 */
  #resetForm() {
    this.tags = [];
    this.rating = 0;
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
    this.pending = true;

    try {
      const [ok, fail] = await batchRun(names, 5, async (fn) => {
        return api.post(`/api/staged/${encodeURIComponent(fn)}`, {
          tags: this.tags,
          rating: this.rating,
        });
      });

      if (ok) {
        addToast(ok === 1 ? `已提交: ${names[0]}` : `已提交 ${ok} 張圖片`, "success");
      }
      if (fail) addToast(`${fail} 張提交失敗`, "error");

      tagCache.invalidate();
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
    if (!(await requestConfirm(msg))) return;

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

  /** 處理 Window 鍵盤事件，執行導航、評等、聚焦、提交或刪除操作 */
  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const { key } = e;

    const actions: Record<string, () => void> = {
      t: () => this.#focusTagInput(),
      T: () => this.#focusTagInput(),
      Enter: () => this.#doCommit(),
      Delete: () => this.#doDelete(),
    };

    const action = actions[key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  // ---

  /** 處理提交按鈕點擊事件 */
  handleCommitClick = () => {
    this.#doCommit();
  };

  /** 處理刪除按鈕點擊事件 */
  handleDeleteClick = () => {
    this.#doDelete();
  };

  /** 處理重置按鈕點擊事件 */
  handleResetClick = () => {
    this.#resetForm();
  };

  /** 處理標籤 Enter 事件，執行提交 */
  handleTagEnter = () => {
    this.#doCommit();
  };
}
