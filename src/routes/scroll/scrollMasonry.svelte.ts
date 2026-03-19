import { navigating } from "$app/state";
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
 * 瀑布流牆的互動邏輯
 */
export class ScrollMasonry {
  /** 瀑布流容器 DOM 引用 */
  containerEl = $state<HTMLElement | null>(null);

  /** 是否正在載入中 */
  loading: boolean;
  /** 是否顯示空狀態提示 */
  showEmpty: boolean;
  /** 瀑布流佈局 */
  layout: ReturnType<typeof createWeightBasedLayout<ImageWithId>>;

  /** 圖片牆虛擬化提供者（虛擬化核心邏輯不強制符合規範） */
  #virtualizer;

  constructor(private options: ScrollMasonryOptions) {
    this.loading = $derived(!!navigating.to);
    this.showEmpty = $derived(options.items.length === 0 && !navigating.to);
    this.layout = $derived(createWeightBasedLayout(options.items, options.columns));

    this.#virtualizer = createVirtualizer(
      () => this.layout,
      () => this.containerEl,
      () => options.pageContentEl,
    );

    $effect(() => {
      this.#detectBreakpoint();
    });
  }

  // ---

  get visibleItems() {
    return this.#virtualizer.visibleItems;
  }

  get totalHeight() {
    return this.#virtualizer.totalHeight;
  }

  // ---

  #detectBreakpoint() {
    const breakpoints = [
      { width: 1600, cols: 6 },
      { width: 1200, cols: 5 },
      { width: 900, cols: 4 },
      { width: 600, cols: 2 },
      { width: 0, cols: 1 },
    ];
    const width = window.innerWidth;
    this.options.columns = breakpoints.find((b) => width >= b.width)?.cols ?? 3;
  }

  // ---

  /** 處理圖片雙擊事件，在新分頁打開編輯器 */
  handleImageDblClick = (img: ImageWithId) => {
    window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
  };
}
