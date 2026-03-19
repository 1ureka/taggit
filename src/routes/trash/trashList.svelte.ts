import { isInEditable } from "$lib/client/dom.js";

/**
 * TrashList 的配置選項
 */
type TrashListOptions = {
  /** 當前頁面的檔案名稱列表 */
  files: string[];
  /** 雙向綁定：已選取的檔案名稱集合 */
  selected: Set<string>;
};

/**
 * TrashList 的互動邏輯
 */
export class TrashList {
  constructor(private options: TrashListOptions) {}

  // ---

  /** 是否有任何檔案被選取 */
  #isSelecting(): boolean {
    return this.options.selected.size > 0;
  }

  /** 選取當前頁面所有檔案 */
  #selectAll() {
    this.options.selected = new Set(this.options.files);
  }

  /** 反轉當前頁面的選取狀態 */
  #invertSelection() {
    const next = new Set<string>();
    for (const f of this.options.files) {
      if (!this.options.selected.has(f)) next.add(f);
    }
    this.options.selected = next;
  }

  /** 清除所有選取 */
  #clearSelection() {
    this.options.selected = new Set();
  }

  /** 切換單個檔案的選取狀態 */
  #toggleSelect(filename: string) {
    const next = new Set(this.options.selected);
    if (next.has(filename)) next.delete(filename);
    else next.add(filename);
    this.options.selected = next;
  }

  // ---

  /** 處理卡片點擊事件 */
  handleCardClick = (filename: string) => {
    this.#toggleSelect(filename);
  };

  /** 處理 Checkbox 變更事件 */
  handleCheckboxChange = (filename: string) => {
    this.#toggleSelect(filename);
  };

  /** 處理 Window 鍵盤事件 */
  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;

    /** Esc 清除選取 */
    if (e.key === "Escape" && this.#isSelecting()) {
      e.preventDefault();
      this.#clearSelection();
      return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;
    const isA = e.key === "a" || e.key === "A";
    const isI = e.key === "i" || e.key === "I";

    /** Ctrl + Shift + A 清除選取 */
    if (isCtrl && isA && e.shiftKey) {
      e.preventDefault();
      this.#clearSelection();
    }

    /** Ctrl + A 全選 */
    if (isCtrl && isA && !e.shiftKey) {
      e.preventDefault();
      this.#selectAll();
    }

    /** Ctrl + I 反轉選取 */
    if (isCtrl && isI) {
      e.preventDefault();
      this.#invertSelection();
    }
  };
}
