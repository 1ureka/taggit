import { throttle } from "$lib/utils.js";

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

  constructor(private options: ScrollButtonOptions) {
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

  /** 處理回到頂部按鈕點擊事件，滾動到頂部 */
  handleFabClick = () => {
    const viewportEl = this.options.viewportEl;
    if (!viewportEl) return;

    // 避免當 resize, filter 等無法預測的事件後，內容變成不須滾動時，onScroll 無法觸發，使用者永遠關閉不了回到頂部按鈕的情況
    if (viewportEl.scrollTop <= 300) this.show = false;

    viewportEl.scrollTo({ top: 0, behavior: "smooth" });
  };
}
