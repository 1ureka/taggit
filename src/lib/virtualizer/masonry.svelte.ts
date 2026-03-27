import type { ItemWithSize, MasonryItem, MasonryLayout } from "$lib/virtualizer/masonry.core";
import { createMasonryContent, createMasonryLayout } from "$lib/virtualizer/masonry.core";
import { untrack } from "svelte";

/**
 * Masonry 的配置選項
 */
type MasonryOptions<T extends ItemWithSize> = {
  /** 初始的項目列表 */
  initialItems: T[];
  /** 預設的欄位數 */
  defaultColumns?: number;
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
 */
export class Masonry<T extends ItemWithSize> {
  /** 滾動容器的 DOM 元素，必須包含 masonryEl 作為直接子元素 */
  viewportEl = $state<HTMLElement | null>(null);
  /** 當需要重新計算布局時的 `make(chan MasonryLayoutChannel<T>)` */
  #dirtyLayoutCh: MasonryLayoutChannel<T> = $state({ items: [], columns: 3 });
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

  // ---

  constructor(options: MasonryOptions<T>) {
    this.#dirtyLayoutCh = { items: options.initialItems, columns: options.defaultColumns ?? 3 };

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

      const resizeObserver = new ResizeObserver(markDirty);
      resizeObserver.observe(viewportEl);
      viewportEl.addEventListener("scroll", markDirty, { passive: true });

      return () => {
        resizeObserver.disconnect();
        viewportEl.removeEventListener("scroll", markDirty);
      };
    });
  }

  // ---

  /** 處理欄位變化事件 */
  handleColumnChange = (columns: number) => {
    // dirtyLayoutCh <- { items: prev.items, columns, layout: undefined }
    this.#dirtyLayoutCh = { items: untrack(() => this.#dirtyLayoutCh.items), columns };
  };

  /** 處理資料載入 */
  handleLoadItems = (items: T[]) => {
    // dirtyLayoutCh <- { items, columns: prev.columns, layout: prev.layout }
    this.#dirtyLayoutCh = { ...untrack(() => this.#dirtyLayoutCh), items };
  };

  /** 處理資料重新載入，比如重新排序等 */
  handleReloadItems = (items: T[]) => {
    // dirtyLayoutCh <- { items, columns: prev.columns, layout: undefined }
    this.#dirtyLayoutCh = { items, columns: untrack(() => this.#dirtyLayoutCh.columns) };
  };
}
