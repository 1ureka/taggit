import { goto } from "$app/navigation";
import { isInEditable } from "$lib/client/dom.js";
import type { ImageWithId } from "$lib/types.js";

/**
 * EditorList 的配置選項
 */
type EditorListOptions = {
  /** 當前頁面的圖片列表 */
  items: ImageWithId[];
  /** 雙向綁定：已選取的圖片 ID 集合 */
  selected: Set<string>;
};

/**
 * EditorList 的互動邏輯
 */
export class EditorList {
  constructor(private options: EditorListOptions) {}

  // ---

  /** 是否有任何圖片被選取 */
  #isSelecting(): boolean {
    return this.options.selected.size > 0;
  }

  /** 選取當前頁面所有圖片 */
  #selectAll() {
    this.options.selected = new Set(this.options.items.map((item) => item.id));
  }

  /** 反轉當前頁面的選取狀態 */
  #invertSelection() {
    const next = new Set<string>();
    for (const item of this.options.items) {
      if (!this.options.selected.has(item.id)) next.add(item.id);
    }
    this.options.selected = next;
  }

  /** 清除所有選取 */
  #clearSelection() {
    this.options.selected = new Set();
  }

  /** 切換單張圖片的選取狀態 */
  #toggleSelect(id: string) {
    const next = new Set(this.options.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.options.selected = next;
  }

  // ---

  /** 處理圖片卡片點擊事件，選取模式下切換選取、否則導航至編輯頁 */
  handleCardClick = (id: string) => {
    if (this.#isSelecting()) {
      this.#toggleSelect(id);
    } else {
      goto(`/editor/${id}`);
    }
  };

  /** 處理 Checkbox 變更事件，切換該圖片的選取狀態 */
  handleCheckboxChange = (id: string) => {
    this.#toggleSelect(id);
  };

  /** 處理 Window 鍵盤事件，執行全選、反轉、清除等快捷鍵操作 */
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
