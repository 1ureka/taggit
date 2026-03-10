import { onMount } from "svelte";
import type { ImageWithId } from "$lib/types.js";
import { createWeightBasedLayout } from "./masonry/masonry-layout.js";
import { createVirtualizer } from "./masonry/virtualizer.svelte.js";

/**
 * ScrollMasonry 的配置選項
 */
type ScrollMasonryOptions = {
  /** 當前頁面的圖片列表 */
  items: ImageWithId[];
  /** 雙向綁定：瀑布流欄位數 */
  columns: number;
  /** 頁面捲動容器 DOM 引用 */
  pageContentEl: HTMLElement | null;
};

/**
 * 建立瀑布流牆邏輯的核心工廠函數
 */
export function createScrollMasonry(options: ScrollMasonryOptions) {
  /** 瀑布流容器 DOM 引用 */
  let containerEl = $state<HTMLElement | null>(null);

  /** 瀑布流佈局 */
  const layout = $derived(createWeightBasedLayout(options.items, options.columns));

  // ---

  /** 圖片牆虛擬化提供者 */
  const virtualizer = createVirtualizer(
    () => layout,
    () => containerEl,
    () => options.pageContentEl,
  );

  /** 偵測瀏覽器寬度並設定對應的欄位數 */
  function detectBreakpoint() {
    const breakpoints = [
      { width: 1600, cols: 6 },
      { width: 1200, cols: 5 },
      { width: 900, cols: 4 },
      { width: 600, cols: 2 },
      { width: 0, cols: 1 },
    ];
    const width = window.innerWidth;
    options.columns = breakpoints.find((b) => width >= b.width)?.cols ?? 3;
  }

  // 僅在掛載時偵測一次作為初始預設值；此頁面不需要 resize 響應。
  onMount(detectBreakpoint);

  // ---

  /** 處理圖片雙擊事件，在新分頁打開編輯器 */
  function handleImageDblClick(img: ImageWithId) {
    window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
  }

  // ---

  return {
    /** 獲取瀑布流容器 DOM 引用的 getter */
    get containerEl() {
      return containerEl;
    },
    /** 設定瀑布流容器 DOM 引用的 setter */
    set containerEl(el: HTMLElement | null) {
      containerEl = el;
    },

    /** 存取可見項目列表的 getter */
    get visibleItems() {
      return virtualizer.visibleItems;
    },
    /** 存取瀑布流總高度的 getter */
    get totalHeight() {
      return virtualizer.totalHeight;
    },

    /** 處理圖片雙擊事件，在新分頁打開編輯器 */
    handleImageDblClick,
  };
}
