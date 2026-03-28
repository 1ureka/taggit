import type { ItemWithSize, MasonryItem, MasonryLayout } from "$lib/virtualizer/masonry.core";
import { createMasonryContent, createMasonryLayout } from "$lib/virtualizer/masonry.core";

/**
 * Masonry 的配置選項
 */
type MasonryOptions<T extends ItemWithSize> = {
  /** 原始的項目列表 */
  get items(): T[];
  /** 水平內邊距，用於在兩側留白 */
  get paddingX(): number | undefined;
  /** 垂直內邊距，用於在上下留白 */
  get paddingY(): number | undefined;
  /** 項目與項目之間的間距，只在呼叫者有實際使用 style 時才生效 */
  get gap(): number | undefined;
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
  /** 布局欄位數量 */
  columns = $state(3);
  /** 當需要重新計算內容時的 `make(chan struct{})` */
  #dirtyCh = $state([]);
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
    this.#layout = $derived(createMasonryLayout({ items: options.items, columns: this.columns }));

    this.#content = $derived.by(() => {
      if (!this.viewportEl) return { visibleItems: [], masonryHeight: 0 };
      this.#dirtyCh; // _ = <-dirtyCh
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

      const markDirty = () => (this.#dirtyCh = []); // dirtyCh <- []

      const resizeObserver = new ResizeObserver(markDirty);
      resizeObserver.observe(viewportEl);
      viewportEl.addEventListener("scroll", markDirty, { passive: true });

      return () => {
        resizeObserver.disconnect();
        viewportEl.removeEventListener("scroll", markDirty);
      };
    });
  }
}
