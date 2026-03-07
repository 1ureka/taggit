import { getTrashContext } from "./context.svelte.js";

/**
 * 建立圖片清單邏輯的核心工廠函數
 */
export function createTrashList() {
  /** Trash 頁面共享的 Context */
  const ctx = getTrashContext();

  // ---

  /** 是否有任何檔案被選取 */
  function isSelecting(): boolean {
    return ctx.selected.size > 0;
  }

  /** 選取當前頁面所有檔案 */
  function selectAll() {
    ctx.selected = new Set(ctx.files);
  }

  /** 反轉當前頁面的選取狀態 */
  function invertSelection() {
    const next = new Set<string>();
    for (const f of ctx.files) {
      if (!ctx.selected.has(f)) next.add(f);
    }
    ctx.selected = next;
  }

  /** 清除所有選取 */
  function clearSelection() {
    ctx.selected = new Set();
  }

  /** 切換單個檔案的選取狀態 */
  function toggleSelect(filename: string) {
    const next = new Set(ctx.selected);
    if (next.has(filename)) {
      next.delete(filename);
    } else {
      next.add(filename);
    }
    ctx.selected = next;
  }

  // ---

  /** 處理圖片卡片點擊事件，切換該檔案的選取狀態 */
  function handleCardClick(filename: string) {
    toggleSelect(filename);
  }

  /** 處理 Checkbox 變更事件，切換該檔案的選取狀態 */
  function handleCheckboxChange(filename: string) {
    toggleSelect(filename);
  }

  /** 處理 Window 鍵盤事件，執行全選、反轉、清除等快捷鍵操作 */
  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isSelecting()) {
      e.preventDefault();
      clearSelection();
      return;
    }

    const target = e.target as HTMLElement;
    const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "a" || e.key === "A") {
        if (e.shiftKey) {
          e.preventDefault();
          clearSelection();
        } else if (!inInput) {
          e.preventDefault();
          selectAll();
        }
        return;
      }
      if ((e.key === "i" || e.key === "I") && !inInput) {
        e.preventDefault();
        invertSelection();
        return;
      }
    }
  }

  // ---

  return {
    /** 處理圖片卡片點擊事件，切換該檔案的選取狀態 */
    handleCardClick,
    /** 處理 Checkbox 變更事件，切換該檔案的選取狀態 */
    handleCheckboxChange,
    /** 處理 Window 鍵盤事件，執行全選、反轉、清除等快捷鍵操作 */
    handleWindowKeydown,
  };
}
