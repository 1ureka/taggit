import type { ItemWithSize, MasonryItem, MasonryLayout } from "$lib/virtualizer/masonry.core";
import { createMasonryContent, createMasonryLayout } from "$lib/virtualizer/masonry.core";

/**
 * 初始斷點設定，根據 viewport 寬度決定欄位數，注意，這不是響應式，也不應該響應式
 */
const breakpoints = [
  { width: 1600, cols: 6 },
  { width: 1200, cols: 5 },
  { width: 900, cols: 4 },
  { width: 600, cols: 2 },
  { width: 0, cols: 1 },
];

/**
 * Masonry 的配置選項
 */
type MasonryOptions<T extends ItemWithSize> = {
  /** 項目陣列，每個項目需包含寬高屬性 */
  get items(): T[];
  /** 水平內邊距，用於在兩側留白 */
  get paddingX(): number | undefined;
  /** 項目與項目之間的間距，只在呼叫者有實際使用 style 時才生效 */
  get gap(): number | undefined;
};

/**
 * 瀑布流牆的互動邏輯
 */
export class Masonry<T extends ItemWithSize> {
  /** 滾動容器的 DOM 元素，必須包含 masonryEl 作為直接子元素 */
  viewportEl = $state<HTMLElement | null>(null);
  /** 瀑布流欄位數 */
  columns = $state(this.#initColumns());
  /** 當 ResizeObserver 偵測到尺寸變化時或發生 scroll 行為時的 channel */
  #dirtyCh = $state([]);
  /** 以權重為基礎的瀑布流佈局結果 */
  #layout: MasonryLayout<T>;
  /** 二分搜尋虛擬化項目計算結果 */
  #content: ReturnType<typeof createMasonryContent<T>>;
  /** 可見的瀑布流項目 */
  masonryItems: MasonryItem<T>[];
  /** 瀑布流內容的總高度 */
  masonryHeight: number;

  constructor(options: MasonryOptions<T>) {
    this.#layout = $derived.by(() => createMasonryLayout(options.items, this.columns));

    this.#content = $derived.by(() => {
      if (!this.viewportEl) return { visibleItems: [], masonryHeight: 0 };
      this.#dirtyCh; // _ = <-dirtyCh
      return createMasonryContent({
        layout: this.#layout,
        viewportEl: this.viewportEl,
        paddingX: options.paddingX,
        gap: options.gap,
      });
    });

    this.masonryItems = $derived(this.#content.visibleItems);
    this.masonryHeight = $derived(this.#content.masonryHeight);

    // ---

    $effect(() => {
      const viewportEl = this.viewportEl;
      if (!viewportEl) return;

      const markDirty = () => {
        this.#dirtyCh = []; // dirtyCh <- []
      };

      const resizeObserver = new ResizeObserver(markDirty);
      resizeObserver.observe(viewportEl);
      viewportEl.addEventListener("scroll", markDirty, { passive: true });

      return () => {
        resizeObserver.disconnect();
        viewportEl.removeEventListener("scroll", markDirty);
      };
    });
  }

  /** 在頁面初始化時決定欄位數 */
  #initColumns() {
    if (typeof window === "undefined") return 3;
    if (typeof window.innerWidth !== "number") return 3;
    const width = window.innerWidth;
    return breakpoints.find((b) => width >= b.width)?.cols ?? 3;
  }

  // ---

  /** 處理欄位變化事件 */
  handleColumnChange = (columns: number) => {
    this.columns = columns;
  };
}
