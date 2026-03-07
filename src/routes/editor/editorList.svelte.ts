import { goto } from "$app/navigation";
import { getEditorContext } from "./store.svelte.js";

/**
 * 建立圖片清單邏輯的核心工廠函數
 */
export function createEditorList() {
  /** Editor 頁面共享的 Context */
  const ctx = getEditorContext();

  // ---

  /** 是否有任何圖片被選取 */
  function isSelecting(): boolean {
    return ctx.selected.size > 0;
  }

  /** 選取當前頁面所有圖片 */
  function selectAll() {
    ctx.selected = new Set(ctx.items.map((item) => item.id));
  }

  /** 反轉當前頁面的選取狀態 */
  function invertSelection() {
    const next = new Set<string>();
    for (const item of ctx.items) {
      if (!ctx.selected.has(item.id)) next.add(item.id);
    }
    ctx.selected = next;
  }

  /** 清除所有選取 */
  function clearSelection() {
    ctx.selected = new Set();
  }

  /** 切換單張圖片的選取狀態 */
  function toggleSelect(id: string) {
    const next = new Set(ctx.selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    ctx.selected = next;
  }

  // ---

  /** 處理圖片卡片點擊事件，選取模式下切換選取、否則導航至編輯頁 */
  function handleCardClick(id: string) {
    if (isSelecting()) {
      toggleSelect(id);
    } else {
      goto(`/editor/${id}`);
    }
  }

  /** 處理 Checkbox 變更事件，切換該圖片的選取狀態 */
  function handleCheckboxChange(id: string) {
    toggleSelect(id);
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
    /** 處理圖片卡片點擊事件，選取模式下切換選取、否則導航至編輯頁 */
    handleCardClick,
    /** 處理 Checkbox 變更事件，切換該圖片的選取狀態 */
    handleCheckboxChange,
    /** 處理 Window 鍵盤事件，執行全選、反轉、清除等快捷鍵操作 */
    handleWindowKeydown,
  };
}
