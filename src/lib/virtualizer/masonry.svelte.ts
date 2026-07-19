import type { ItemWithSize, MasonryItem, MasonryLayout } from "./masonry.core";
import { createMasonryContent, createMasonryLayout } from "./masonry.core";

/**
 * Masonry 的配置選項
 */
type MasonryOptions<T extends ItemWithSize> = {
  /** 原始的項目列表 */
  get items(): T[];
  /** 布局欄位數量 */
  get columns(): number;
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
  /** 當需要重新計算內容時的 `make(chan struct{})` */
  #dirtyCh = $state([]);
  /** 建立時傳入的配置 */
  #options: MasonryOptions<T>;
  /** 以權重為基礎的瀑布流佈局結果 */
  layout: MasonryLayout<T>;
  /** 二分搜尋虛擬化項目計算結果 */
  #content: ReturnType<typeof createMasonryContent<T>>;
  /** 可見的瀑布流項目 */
  masonryItems: MasonryItem<T>[];
  /** 瀑布流內容的總高度 */
  masonryHeight: number;

  // ---

  constructor(options: MasonryOptions<T>) {
    this.#options = options;
    this.layout = $derived(createMasonryLayout({ items: options.items, columns: options.columns }));

    this.#content = $derived.by(() => {
      if (!this.viewportEl) return { visibleItems: [], masonryHeight: 0 };
      this.#dirtyCh; // _ = <-dirtyCh
      return createMasonryContent({
        layout: this.layout,
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

  // ---

  /**
   * 取得指定項目在目前視口下的像素位置（相對於 masonryEl 頂端）。
   *
   * 與 {@link createMasonryContent} 用同一套座標公式，是像素座標的唯一來源，
   * 呼叫端不需自行重算。尚未量測（無 viewportEl／無欄）或找不到項目時回傳 null。
   * gap 只是項目 box 內的 padding、不影響位置，故此處不需納入。
   */
  #getItemRect(id: string): { top: number; height: number } | null {
    const viewportEl = this.viewportEl;
    if (!viewportEl) return null;

    const columns = this.layout.tracks.length;
    if (columns === 0) return null;

    const paddingX = this.#options.paddingX ?? 0;
    const paddingY = this.#options.paddingY ?? 0;
    const pixelColumnWidth = (viewportEl.clientWidth - paddingX * 2) / columns;
    if (pixelColumnWidth <= 0) return null;

    for (const track of this.layout.tracks) {
      const found = track.find((t) => t.item.id === id);
      if (found === undefined) continue;
      return {
        top: found.yStart * pixelColumnWidth + paddingY,
        height: (found.yEnd - found.yStart) * pixelColumnWidth,
      };
    }
    return null;
  }

  /**
   * 將指定項目捲進可視範圍。
   *
   * - `block: "nearest"`（預設）：已在可視範圍內就不動，否則捲到最近的一邊。
   * - `block: "start" | "end"`：對齊視口的上／下緣。
   * 找不到項目或尚未量測時為無操作。
   */
  scrollToItem(id: string, opts: { behavior?: ScrollBehavior; block?: "nearest" | "start" | "end" } = {}): void {
    const viewportEl = this.viewportEl;
    if (!viewportEl) return;

    const rect = this.#getItemRect(id);
    if (rect === null) return;

    const { behavior = "smooth", block = "nearest" } = opts;
    const viewTop = viewportEl.scrollTop;
    const viewBottom = viewTop + viewportEl.clientHeight;
    const itemTop = rect.top;
    const itemBottom = rect.top + rect.height;

    let top: number | null = null;
    if (block === "start") {
      top = itemTop;
    } else if (block === "end") {
      top = itemBottom - viewportEl.clientHeight;
    } else if (itemTop < viewTop) {
      top = itemTop;
    } else if (itemBottom > viewBottom) {
      top = itemBottom - viewportEl.clientHeight;
    }

    if (top !== null) viewportEl.scrollTo({ top, behavior });
  }
}
