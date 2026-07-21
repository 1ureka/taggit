import type { ItemWithSize, VirtualizeItem, VirtualizeLayout, VirtualizeSizing } from "./virtualize.core";
import { createVirtualizeContent, createVirtualizeLayout, getItemPixelRect } from "./virtualize.core";

/** 兩種虛擬化模式共用的版面配置選項 */
type CommonOptions = {
  /** 水平內邊距，用於在兩側留白 */
  get paddingX(): number | undefined;
  /** 垂直內邊距，用於在上下留白 */
  get paddingY(): number | undefined;
  /** 項目與項目之間的間距，只在呼叫者有實際使用 style 時才生效 */
  get gap(): number | undefined;
};

/** {@link Virtualizer.masonry} 的配置選項 */
type MasonryOptions<T extends ItemWithSize> = CommonOptions & {
  /** 原始的項目列表 */
  get items(): T[];
  /** 布局欄位數量 */
  get columns(): number;
};

/** {@link Virtualizer.list} 的配置選項 */
type ListOptions<T extends { id: string }> = CommonOptions & {
  /** 原始的項目列表 */
  get items(): T[];
  /** 固定列高（像素） */
  get itemHeight(): number;
};

/** 內部統一持有的配置，兩個 static factory 各自投影成這個形狀 */
type NormalizedOptions<T extends { id: string }> = CommonOptions & {
  get items(): T[];
  get columns(): number;
  get sizing(): VirtualizeSizing;
};

/**
 * 通用虛擬化容器：權重式貪婪欄位分配 + 二分搜尋可視項目。
 *
 * - {@link Virtualizer.masonry}：等比例縮放瀑布流（欄寬變動時項目高度等比例縮放）
 * - {@link Virtualizer.list}：固定列高單欄清單（欄寬變動不影響列高）
 *
 * - viewportEl 只能包含唯一子元素（容納所有 visibleItems 的容器）作為直接子元素
 * - viewportEl 與該子元素都不得包含 padding, border 等 CSS 屬性
 */
export class Virtualizer<T extends { id: string }> {
  /** 滾動容器的 DOM 元素，必須包含唯一子元素作為直接子元素 */
  viewportEl = $state<HTMLElement | null>(null);
  /** 當需要重新計算內容時的 `make(chan struct{})` */
  #dirtyCh = $state([]);
  /** 建立時傳入的配置 */
  #options: NormalizedOptions<T>;
  /** 以權重為基礎的虛擬化佈局結果 */
  #layout: VirtualizeLayout<T>;
  /** 二分搜尋虛擬化項目計算結果 */
  #content: ReturnType<typeof createVirtualizeContent<T>>;
  /** 可見的虛擬化項目 */
  visibleItems: VirtualizeItem<T>[];
  /** 虛擬化內容的總高度 */
  contentHeight: number;

  // ---

  private constructor(options: NormalizedOptions<T>) {
    this.#options = options;
    this.#layout = $derived(
      createVirtualizeLayout({ items: options.items, columns: options.columns, sizing: options.sizing }),
    );

    this.#content = $derived.by(() => {
      if (!this.viewportEl) return { visibleItems: [], contentHeight: 0 };
      this.#dirtyCh; // _ = <-dirtyCh
      return createVirtualizeContent({
        layout: this.#layout,
        viewportEl: this.viewportEl,
        paddingX: options.paddingX,
        paddingY: options.paddingY,
        gap: options.gap,
        sizing: options.sizing,
      });
    });

    this.visibleItems = $derived(this.#content.visibleItems);
    this.contentHeight = $derived(this.#content.contentHeight);

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

  /** 等比例縮放瀑布流牆：項目依 {@link ItemWithSize} 的寬高比分配，欄寬變動時等比例縮放 */
  static masonry<T extends ItemWithSize>(options: MasonryOptions<T>): Virtualizer<T> {
    return new Virtualizer<T>({
      get items() {
        return options.items;
      },
      get columns() {
        return options.columns;
      },
      get paddingX() {
        return options.paddingX;
      },
      get paddingY() {
        return options.paddingY;
      },
      get gap() {
        return options.gap;
      },
      get sizing() {
        return { mode: "proportional" as const };
      },
    });
  }

  /** 固定列高單欄清單：每個項目固定佔 `itemHeight` 像素高，不隨容器寬度縮放 */
  static list<T extends { id: string }>(options: ListOptions<T>): Virtualizer<T> {
    return new Virtualizer<T>({
      get items() {
        return options.items;
      },
      get columns() {
        return 1;
      },
      get paddingX() {
        return options.paddingX;
      },
      get paddingY() {
        return options.paddingY;
      },
      get gap() {
        return options.gap;
      },
      get sizing() {
        return { mode: "fixed" as const, itemHeight: options.itemHeight };
      },
    });
  }

  // ---

  /**
   * 取得指定項目在目前視口下的像素位置（相對於內容容器頂端）。
   * 與 {@link createVirtualizeContent} 用同一套座標公式，供 {@link scrollToItem} 呼叫。
   */
  #getItemRect(id: string): { top: number; height: number } | null {
    const viewportEl = this.viewportEl;
    if (!viewportEl) return null;

    return getItemPixelRect({
      layout: this.#layout,
      id,
      viewportEl,
      paddingX: this.#options.paddingX,
      paddingY: this.#options.paddingY,
      sizing: this.#options.sizing,
    });
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
