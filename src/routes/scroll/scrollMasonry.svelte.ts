import { onMount } from "svelte";
import type { ImageWithId } from "$lib/types.js";
import { throttle } from "$lib/utils.js";
import { getScrollContext } from "./context.svelte.js";
import { createWeightBasedLayout } from "./masonry.js";
import { createVirtualizer } from "./virtualizer.svelte.js";

/**
 * 建立瀑布流牆邏輯的核心工廠函數
 */
export function createScrollMasonry() {
  /** Scroll 頁面共享的 Context */
  const ctx = getScrollContext();

  /** 瀑布流容器 DOM 引用 */
  let containerEl = $state<HTMLElement | null>(null);
  /** 是否顯示回到頂部按鈕 */
  let showFab = $state(false);

  /** 瀑布流佈局 */
  const layout = $derived(createWeightBasedLayout(ctx.items, ctx.columns));

  // ---

  /** 圖片牆虛擬化提供者 */
  const virtualizer = createVirtualizer(
    () => layout,
    () => containerEl,
    () => ctx.pageContentEl,
  );

  /** 偵測瀏覽器寬度並設定對應的欄位數 */
  function detectBreakpoint() {
    const breakpoints = [
      { width: 1600, cols: 6 },
      { width: 1200, cols: 5 },
      { width: 900, cols: 4 },
      { width: 600, cols: 2 },
      { width: 0, cols: 1 },
    ];
    const width = window.innerWidth;
    ctx.columns = breakpoints.find((b) => width >= b.width)?.cols ?? 3;
  }

  onMount(detectBreakpoint);

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

  /** 處理圖片雙擊事件，在新分頁打開編輯器 */
  function handleImageDblClick(img: ImageWithId) {
    window.open(`/editor/${encodeURIComponent(img.id)}`, "_blank");
  }

  // ---

  return {
    /** 獲取瀑布流容器 DOM 引用的 getter */
    get containerEl() {
      return containerEl;
    },
    /** 設定瀑布流容器 DOM 引用的 setter */
    set containerEl(el: HTMLElement | null) {
      containerEl = el;
    },

    /** 存取是否顯示回到頂部按鈕的 getter */
    get showFab() {
      return showFab;
    },
    /** 存取可見項目列表的 getter */
    get visibleItems() {
      return virtualizer.visibleItems;
    },
    /** 存取瀑布流總高度的 getter */
    get totalHeight() {
      return virtualizer.totalHeight;
    },

    /** 處理 FAB 點擊事件，滾動到頂部 */
    handleFabClick,
    /** 處理圖片雙擊事件，在新分頁打開編輯器 */
    handleImageDblClick,
  };
}
