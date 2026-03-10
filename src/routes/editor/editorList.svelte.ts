import { goto } from "$app/navigation";
import { navigating } from "$app/state";
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
 * 建立圖片清單邏輯的核心工廠函數
 */
export function createEditorList(options: EditorListOptions) {
  /** 是否顯示載入提示（延遲顯示） */
  let showLoading = $state(false);

  // ---

  /** 載入提示延遲毫秒數 */
  const LOADING_DELAY = 200;

  // ---

  /** 是否有任何圖片被選取 */
  function isSelecting(): boolean {
    return options.selected.size > 0;
  }

  /** 選取當前頁面所有圖片 */
  function selectAll() {
    options.selected = new Set(options.items.map((item) => item.id));
  }

  /** 反轉當前頁面的選取狀態 */
  function invertSelection() {
    const next = new Set<string>();
    for (const item of options.items) {
      if (!options.selected.has(item.id)) next.add(item.id);
    }
    options.selected = next;
  }

  /** 清除所有選取 */
  function clearSelection() {
    options.selected = new Set();
  }

  /** 切換單張圖片的選取狀態 */
  function toggleSelect(id: string) {
    const next = new Set(options.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    options.selected = next;
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

    const inInput = isInEditable(e.target);

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

  /** 追蹤導航狀態，延遲顯示載入提示 */
  $effect(() => {
    if (navigating.to) {
      const timer = setTimeout(() => {
        showLoading = true;
      }, LOADING_DELAY);
      return () => {
        clearTimeout(timer);
        showLoading = false;
      };
    }
  });

  // ---

  return {
    /** 存取是否顯示載入提示的 getter */
    get showLoading() {
      return showLoading;
    },

    /** 處理圖片卡片點擊事件，選取模式下切換選取、否則導航至編輯頁 */
    handleCardClick,
    /** 處理 Checkbox 變更事件，切換該圖片的選取狀態 */
    handleCheckboxChange,
    /** 處理 Window 鍵盤事件，執行全選、反轉、清除等快捷鍵操作 */
    handleWindowKeydown,
  };
}
