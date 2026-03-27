import { throttle } from "$lib/utils.js";

/**
 * ScrollFab 的配置選項
 */
type ScrollFabOptions = {
  /** 滾動容器 DOM 引用 */
  viewportEl: HTMLElement | null;
};

/**
 * ScrollFab 的互動邏輯
 */
export class ScrollFab {
  /** 是否顯示回到頂部按鈕 */
  show = $state(false);

  constructor(private options: ScrollFabOptions) {
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
    this.options.viewportEl?.scrollTo({ top: 0, behavior: "smooth" });
  };
}
