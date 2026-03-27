import type { ItemWithSize, MasonryItem, MasonryLayout } from "$lib/virtualizer/masonry.core";
import { createMasonryContent, createMasonryLayout } from "$lib/virtualizer/masonry.core";
import { RAFAggregator } from "$lib/virtualizer/raf-aggregator.js";

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
 * 預設的欄位數
 */
const defaultColumns = 3;

/**
 * Masonry 的配置選項
 */
type MasonryOptions = {
  /** 水平內邊距，用於在兩側留白 */
  get paddingX(): number | undefined;
  /** 垂直內邊距，用於在上下留白 */
  get paddingY(): number | undefined;
  /** 項目與項目之間的間距，只在呼叫者有實際使用 style 時才生效 */
  get gap(): number | undefined;
};

/**
 * Masonry 的布局通道型別
 */
type MasonryLayoutChannel<T extends ItemWithSize> = {
  items: T[];
  columns: number;
  layout?: MasonryLayout<T>;
};

/**
 * 瀑布流牆的互動邏輯
 *
 * - viewportEl 只能包含 masonryEl (包含所有 visibleItems 的容器) 作為直接子元素
 * - viewportEl 與 masonryEl  不得包含 padding, border 等 CSS 屬性
 *
 * ---
 *
 * * @example <caption>頁面首次渲染</caption>
 * ```svelte
 * <script lang="ts">
 *   let { data }: { data: PageData } = $props();
 *   const masonry = new Masonry({paddingX: 8, paddingY: 8, gap: 8});
 *   masonry.handleLoadItems(data.items); // 該行在首次載入 SSR 將能夠執行，確保初始畫面就已經算完並顯示
 * </script>
 * ```
 * * @example <caption>分頁載入更多</caption>
 * ```svelte
 * <script lang="ts">
 *   const loadMore = async () => {
 *     const newItems = await fetch({page: page + 1, size: 20});
 *     masonry.handleLoadItems(newItems);
 *   };
 * </script>
 * ```
 * * @example <caption>重新排序</caption>
 * ```svelte
 * <script lang="ts">
 *   $effect(() => {
 *     masonry.handleResetItems(data.items);
 *   });
 *   const sortBy = async (criteria: SortCriteria) => {
 *     await goto(`?sort=${criteria}`, { ... });
 *   };
 * </script>
 * ```
 */
export class Masonry<T extends ItemWithSize> {
  /** 滾動容器的 DOM 元素，必須包含 masonryEl 作為直接子元素 */
  viewportEl = $state<HTMLElement | null>(null);
  /** 當需要重新計算布局時的 `make(chan MasonryLayoutChannel<T>)` */
  #dirtyLayoutCh: MasonryLayoutChannel<T> = $state({ items: [], columns: this.#initColumns() });
  /** 當需要重新計算內容時的 `make(chan struct{})` */
  #dirtyContentCh = $state([]);
  /** 以權重為基礎的瀑布流佈局結果 */
  #layout: MasonryLayout<T>;
  /** 二分搜尋虛擬化項目計算結果 */
  #content: ReturnType<typeof createMasonryContent<T>>;
  /** 可見的瀑布流項目 */
  masonryItems: MasonryItem<T>[];
  /** 瀑布流內容的總高度 */
  masonryHeight: number;

  constructor(options: MasonryOptions) {
    this.#layout = $derived.by(() => {
      const { items, columns, layout } = this.#dirtyLayoutCh; // ... <-dirtyLayoutCh

      if (layout) {
        return createMasonryLayout({ items, columns, existingLayout: layout });
      }

      if (items.length === 0) {
        return { tracks: [], yMax: 0 };
      }

      return createMasonryLayout({ items, columns });
    });

    this.#content = $derived.by(() => {
      if (!this.viewportEl) return { visibleItems: [], masonryHeight: 0 };
      this.#dirtyContentCh; // _ = <-dirtyContentCh
      return createMasonryContent({
        layout: this.#layout,
        viewportEl: this.viewportEl,
        paddingX: options.paddingX,
        paddingY: options.paddingY,
        gap: options.gap,
      });
    });

    this.masonryItems = $derived(this.#content.visibleItems);
    this.masonryHeight = $derived(this.#content.masonryHeight);

    // ---

    $effect(() => {
      const viewportEl = this.viewportEl;
      if (!viewportEl) return;

      const markDirty = () => (this.#dirtyContentCh = []); // dirtyContentCh <- []

      const aggregator = new RAFAggregator(markDirty, { fps: 30, idleTimeout: 500 });
      const handleEvent = () => aggregator.notify();

      const resizeObserver = new ResizeObserver(handleEvent);
      resizeObserver.observe(viewportEl);
      viewportEl.addEventListener("scroll", handleEvent, { passive: true });

      return () => {
        resizeObserver.disconnect();
        viewportEl.removeEventListener("scroll", handleEvent);
      };
    });
  }

  /** 在頁面初始化時決定欄位數 */
  #initColumns() {
    if (typeof window === "undefined") return defaultColumns;
    if (typeof window.innerWidth !== "number") return defaultColumns;
    const width = window.innerWidth;
    return breakpoints.find((b) => width >= b.width)?.cols ?? defaultColumns;
  }

  // ---

  /** 處理欄位變化事件 */
  handleColumnChange = (columns: number) => {
    // dirtyLayoutCh <- { items: prev.items, columns, layout: undefined }
    this.#dirtyLayoutCh = { items: this.#dirtyLayoutCh.items, columns };
  };

  /** 處理資料載入 */
  handleLoadItems = (items: T[]) => {
    // dirtyLayoutCh <- { items, columns: prev.columns, layout: prev.layout }
    this.#dirtyLayoutCh = { ...this.#dirtyLayoutCh, items };
  };

  /** 處理資料重設，比如重新排序等 */
  handleResetItems = (items: T[]) => {
    // dirtyLayoutCh <- { items, columns: prev.columns, layout: undefined }
    this.#dirtyLayoutCh = { items, columns: this.#dirtyLayoutCh.columns };
  };
}
