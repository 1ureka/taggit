import { throttle } from "$lib/utils.js";

/**
 * ScrollFab 的配置選項
 */
type ScrollFabOptions = {
  /** 頁面捲動容器 DOM 引用 */
  pageContentEl: HTMLElement | null;
};

/**
 * 建立回到頂部按鈕邏輯的核心工廠函數
 */
export function createScrollFab(options: ScrollFabOptions) {
  /** 是否顯示回到頂部按鈕 */
  let showFab = $state(false);

  // ---

  /** 處理 FAB 點擊事件，滾動到頂部 */
  function handleFabClick() {
    options.pageContentEl?.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---

  // 監聽頁面捲動事件以控制回到頂部按鈕顯示
  $effect(() => {
    const el = options.pageContentEl;
    if (!el) return;

    const onScroll = throttle(() => {
      showFab = el.scrollTop > 300;
    }, 150);

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  // ---

  return {
    /** 存取是否顯示回到頂部按鈕的 getter */
    get showFab() {
      return showFab;
    },

    /** 處理 FAB 點擊事件，滾動到頂部 */
    handleFabClick,
  };
}
