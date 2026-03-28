import { throttle } from "$lib/utils.js";

/**
 * BrowseFab 的配置選項
 */
type BrowseFabOptions = {
  /** 滾動容器 DOM 引用 */
  viewportEl: HTMLElement | null;
};

/**
 * BrowseFab 的互動邏輯
 */
export class BrowseFab {
  /** 是否顯示回到頂部按鈕 */
  show = $state(false);

  constructor(private options: BrowseFabOptions) {
    $effect(() => {
      const el = options.viewportEl;
      if (!el) return;

      const onScroll = throttle(() => {
        this.show = el.scrollTop > 300;
      }, 150);

      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    });
  }

  /** 處理 FAB 點擊事件，滾動到頂部 */
  handleFabClick = () => {
    const viewportEl = this.options.viewportEl;
    if (!viewportEl) return;

    // 避免當 resize, filter 等無法預測的事件後，內容變成不須滾動時，onScroll 無法觸發，使用者永遠關閉不了 FAB 的情況
    if (viewportEl.scrollTop <= 300) this.show = false;

    viewportEl.scrollTo({ top: 0, behavior: "smooth" });
  };
}
