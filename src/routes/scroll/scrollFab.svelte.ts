import { throttle } from "$lib/utils.js";
import { getScrollContext } from "./context.svelte.js";

/**
 * 建立回到頂部按鈕邏輯的核心工廠函數
 */
export function createScrollFab() {
  /** Scroll 頁面共享的 Context */
  const ctx = getScrollContext();

  /** 是否顯示回到頂部按鈕 */
  let showFab = $state(false);

  // ---

  // 監聽頁面捲動事件以控制回到頂部按鈕顯示
  $effect(() => {
    const el = ctx.pageContentEl;
    if (!el) return;

    const onScroll = throttle(() => {
      showFab = el.scrollTop > 300;
    }, 150);

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  // ---

  /** 處理 FAB 點擊事件，滾動到頂部 */
  function handleFabClick() {
    ctx.pageContentEl?.scrollTo({ top: 0, behavior: "smooth" });
  }

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
