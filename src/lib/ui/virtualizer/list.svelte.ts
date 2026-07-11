import { scrollToActive } from "$lib/ui/dom";

/**
 * 虛擬垂直列表的配置選項
 */
type ListOptions<T> = {
  /** 原始列表項目 */
  get items(): T[];
  /** 目前的索引 */
  get currentIndex(): number | null;
  /** 點擊某個項目的 callback */
  get onClickItem(): ((item: T, mode: "single" | "ctrl" | "shift") => void) | undefined;
  /** 每個項目的高度 */
  get itemHeight(): number;
};

/**
 * 虛擬垂直列表的邏輯
 */
export class List<T> {
  /** 捲動容器 DOM 引用 */
  viewportEl = $state<HTMLElement | null>(null);
  /** 虛擬列表渲染緩衝區大小 */
  readonly #buffer = 3;
  /** 捲動容器目前的 scrollTop */
  #scrollTop = $state(0);
  /** 捲動容器可見高度 */
  #viewportHeight = $state(typeof window !== "undefined" ? window.innerHeight : 400);
  /** 虛擬列表內容總高度 */
  listHeight: number;
  /** 可見的項目列表 */
  visibleItems: (T & { top: number; height: number })[];

  constructor(private options: ListOptions<T>) {
    this.listHeight = $derived(options.items.length * options.itemHeight);

    this.visibleItems = $derived.by(() => {
      const items = options.items;
      const itemHeight = options.itemHeight;
      const currentIndex = options.currentIndex;

      const firstVisibleIdx = Math.floor(this.#scrollTop / itemHeight);
      const visibleCount = Math.ceil(this.#viewportHeight / itemHeight);

      const startIdx = Math.max(0, firstVisibleIdx - this.#buffer);
      const endIdx = Math.min(items.length, firstVisibleIdx + visibleCount + this.#buffer);

      const visibleItems = items.slice(startIdx, endIdx).map((item, i) => ({
        ...item,
        top: (startIdx + i) * itemHeight,
        height: itemHeight,
      }));

      // 以下將確保 ID 存在於 DOM，保證 aria-activedescendant 可用
      if (currentIndex === null) return visibleItems;
      if (currentIndex >= startIdx && currentIndex < endIdx) return visibleItems;

      const currentItem = {
        ...items[currentIndex],
        top: currentIndex * itemHeight,
        height: itemHeight,
      };

      if (currentIndex < startIdx && currentIndex >= 0) {
        visibleItems.unshift(currentItem);
      } else if (currentIndex >= endIdx && currentIndex < items.length) {
        visibleItems.push(currentItem);
      }

      return visibleItems;
    });

    // 監聽 currentIndex，將對應項目捲入可視區域
    $effect(() => {
      if (!this.viewportEl) return;
      if (options.currentIndex === null) return;

      const idx = options.currentIndex;
      if (idx >= 0) scrollToActive(this.viewportEl, idx, options.itemHeight);
    });

    // ResizeObserver 監聽容器高度
    $effect(() => {
      if (!this.viewportEl) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const e of entries) this.#viewportHeight = e.contentRect.height;
      });

      resizeObserver.observe(this.viewportEl);
      return () => resizeObserver.disconnect();
    });
  }

  // ---

  /** 處理列表本身的點擊事件 */
  handleListClick = (e: MouseEvent) => {
    if (!this.viewportEl) return;

    const rect = this.viewportEl.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const absoluteY = relativeY + this.viewportEl.scrollTop;
    const index = Math.floor(absoluteY / this.options.itemHeight);

    if (index < 0 || index >= this.options.items.length) return;

    const item = this.options.items[index];
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";

    if (this.options.onClickItem) this.options.onClickItem(item, mode);
  };

  /** 處理列表捲動事件 */
  handleListScroll = () => {
    if (this.viewportEl) this.#scrollTop = this.viewportEl.scrollTop;
  };
}
