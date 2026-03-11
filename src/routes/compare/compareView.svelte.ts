import { goto, afterNavigate, invalidateAll } from "$app/navigation";
import { page } from "$app/state";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";
import { isInEditable } from "$lib/client/dom.js";

/**
 * 建立比較頁面邏輯的核心工廠函數
 */
export function createCompareView() {
  /** 從 URL 讀取初始值 */
  const init = parseQueryParams(page.url);

  /** 篩選標籤 */
  let filterTags = $state<string[]>(init.tags ?? []);
  /** 最低評等篩選值（0 = 不篩選） */
  let filterMinRating = $state(init.rating ?? 0);

  // ---

  /** Popstate 時從 URL 同步篩選狀態，避免與 goto 導航衝突 */
  afterNavigate(({ type }) => {
    if (type === "popstate") {
      const vals = parseQueryParams(page.url);
      filterTags = vals.tags ?? [];
      filterMinRating = vals.rating ?? 0;
    }
  });

  /** 根據目前篩選狀態構建 query string */
  function currentQueryString(): string {
    return buildQueryString({
      tags: filterTags,
      rating: filterMinRating > 0 ? filterMinRating : undefined,
    });
  }

  // ---

  /** 處理 Filter 變更事件，以 goto() 導航觸發 SSR 重跑 */
  function handleFilterChange() {
    goto(`/compare${currentQueryString()}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  /** 處理 Shuffle 按鈕點擊事件，invalidateAll 強制 load 重跑 */
  function handleShuffleClick() {
    invalidateAll();
  }

  /** 處理 Card 點擊事件，在 Editor 中開啟圖片 */
  function handleCardClick(id: string) {
    window.open(`/editor/${encodeURIComponent(id)}`, "_blank");
  }

  // ---

  /** 處理 Window 鍵盤事件，按空白鍵觸發 Shuffle */
  function handleWindowKeydown(e: KeyboardEvent) {
    if (isInEditable(e.target)) return;

    /** 當按下空白鍵時，觸發 Shuffle */
    if (e.key === " ") {
      e.preventDefault();
      invalidateAll();
    }
  }

  // ---

  return {
    /** 存取篩選標籤的 getter */
    get filterTags() {
      return filterTags;
    },
    /** 設定篩選標籤的 setter */
    set filterTags(v: string[]) {
      filterTags = v;
    },
    /** 存取最低評等篩選值的 getter */
    get filterMinRating() {
      return filterMinRating;
    },
    /** 設定最低評等篩選值的 setter */
    set filterMinRating(v: number) {
      filterMinRating = v;
    },

    /** 處理 Filter 變更事件，以 goto() 導航觸發 SSR 重跑 */
    handleFilterChange,
    /** 處理 Shuffle 按鈕點擊事件，invalidateAll 強制 load 重跑 */
    handleShuffleClick,
    /** 處理 Card 點擊事件，在 Editor 中開啟圖片 */
    handleCardClick,
    /** 處理 Window 鍵盤事件，按空白鍵觸發 Shuffle */
    handleWindowKeydown,
  };
}
