import { throttle } from "$lib/utils/shared.js";

/**
 * 回到頂部的配置選項
 */
type ScrollButtonOptions = {
  /** 滾動容器 DOM 引用 */
  viewportEl: HTMLElement | null;
};

/**
 * 回到頂部按鈕的互動邏輯
 */
export class ScrollButton {
  /** 是否顯示回到頂部按鈕 */
  show = $state(false);
  /** 上一次滾動位置 */
  #lastScrollTop = 0;

  constructor(private options: ScrollButtonOptions) {
    $effect(() => {
      const el = options.viewportEl;
      if (!el) return;

      const onScroll = throttle(() => {
        const currentScrollTop = el.scrollTop;

        if (currentScrollTop <= 300) {
          this.show = false;
        } else {
          this.show = currentScrollTop > this.#lastScrollTop;
        }

        this.#lastScrollTop = currentScrollTop;
      }, 80);

      el.addEventListener("scroll", onScroll, { passive: true });
      return () => el.removeEventListener("scroll", onScroll);
    });
  }

  /** 處理回到頂部按鈕點擊事件，滾動到頂部 */
  handleFabClick = () => {
    const viewportEl = this.options.viewportEl;
    if (!viewportEl) return;

    this.show = false;
    viewportEl.scrollTo({ top: 0, behavior: "smooth" });
  };
}
