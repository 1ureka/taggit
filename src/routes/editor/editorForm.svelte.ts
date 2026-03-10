import { goto, afterNavigate } from "$app/navigation";
import { page } from "$app/state";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";

/**
 * 建立搜尋表單邏輯的核心工廠函數
 */
export function createEditorForm() {
  /** 從 URL 讀取初始值 */
  const init = parseQueryParams(page.url);

  /** 搜尋文字 */
  let searchValue = $state(init.search ?? "");
  /** 已選的篩選標籤 */
  let selectedTags = $state<string[]>(init.tags ?? []);
  /** 評等篩選值 */
  let rating = $state<number | undefined>(init.rating);
  /** 評等比較運算子 */
  let ratingOp = $state<"gte" | "lte" | "eq">(init.ratingOp ?? "gte");
  /** 排序欄位 */
  let sort = $state<"committedAt" | "rating" | "name" | "random">(init.sort ?? "committedAt");
  /** 排序方向 */
  let order = $state<"asc" | "desc">(init.order ?? "desc");

  // ---

  /** 搜尋文字 debounce 毫秒數 */
  const SEARCH_DEBOUNCE = 300;

  /** 搜尋文字 debounce 計時器 */
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  // ---

  /** Popstate 時從 URL 同步篩選狀態，避免與 goto 導航衝突 */
  afterNavigate(({ type }) => {
    if (type === "popstate") {
      const vals = parseQueryParams(page.url);
      searchValue = vals.search ?? "";
      selectedTags = vals.tags ?? [];
      rating = vals.rating;
      ratingOp = vals.ratingOp ?? "gte";
      sort = vals.sort ?? "committedAt";
      order = vals.order ?? "desc";
    }
  });

  /** 根據目前篩選狀態構建 query string */
  function currentQueryString(): string {
    return buildQueryString({ search: searchValue, tags: selectedTags, rating, ratingOp, sort, order });
  }

  // ---

  /** 處理搜尋輸入框 input 事件，以 debounce 方式觸發 URL 導航 */
  function handleSearchInput() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      goto(`/editor${currentQueryString()}`, { replaceState: true, noScroll: true, keepFocus: true });
    }, SEARCH_DEBOUNCE);
  }

  /** 處理篩選條件變更事件，立即觸發 URL 導航 */
  function handleFilterChange() {
    goto(`/editor${currentQueryString()}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // ---

  return {
    /** 存取搜尋文字的 getter */
    get searchValue() {
      return searchValue;
    },
    /** 設定搜尋文字的 setter */
    set searchValue(v: string) {
      searchValue = v;
    },
    /** 存取已選篩選標籤的 getter */
    get selectedTags() {
      return selectedTags;
    },
    /** 設定已選篩選標籤的 setter */
    set selectedTags(v: string[]) {
      selectedTags = v;
    },
    /** 存取評等篩選值的 getter */
    get rating() {
      return rating;
    },
    /** 設定評等篩選值的 setter */
    set rating(v: number | undefined) {
      rating = v;
    },
    /** 存取評等比較運算子的 getter */
    get ratingOp() {
      return ratingOp;
    },
    /** 設定評等比較運算子的 setter */
    set ratingOp(v: "gte" | "lte" | "eq") {
      ratingOp = v;
    },
    /** 存取排序欄位的 getter */
    get sort() {
      return sort;
    },
    /** 設定排序欄位的 setter */
    set sort(v: "committedAt" | "rating" | "name" | "random") {
      sort = v;
    },
    /** 存取排序方向的 getter */
    get order() {
      return order;
    },
    /** 設定排序方向的 setter */
    set order(v: "asc" | "desc") {
      order = v;
    },

    /** 處理搜尋輸入框 input 事件，以 debounce 方式觸發 URL 導航 */
    handleSearchInput,
    /** 處理篩選條件變更事件，立即觸發 URL 導航 */
    handleFilterChange,
  };
}
