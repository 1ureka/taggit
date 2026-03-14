import { page } from "$app/state";
import { goto } from "$app/navigation";
import { untrack } from "svelte";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";

/**
 * EditorForm 的互動邏輯
 */
export class EditorForm {
  /** URL 同步鎖：搜尋正在修改時為 true，跳過外部同步 */
  dirty = $state(false);
  /** 搜尋文字 */
  search = $state("");
  /** 已選的篩選標籤 */
  selectedTags = $state<string[]>([]);
  /** 評等篩選值 */
  rating = $state<number | undefined>(undefined);
  /** 評等比較運算子 */
  ratingOp = $state<"gte" | "lte" | "eq">("gte");
  /** 排序欄位 */
  sort = $state<"committedAt" | "rating" | "name" | "random">("committedAt");
  /** 排序方向 */
  order = $state<"asc" | "desc">("desc");

  /** 搜尋文字 debounce 計時器 */
  #searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const init = untrack(() => parseQueryParams(page.url));
    this.search = init.search ?? "";
    this.selectedTags = init.tags ?? [];
    this.rating = init.rating;
    this.ratingOp = init.ratingOp ?? "gte";
    this.sort = init.sort ?? "committedAt";
    this.order = init.order ?? "desc";

    $effect(() => {
      const vals = parseQueryParams(page.url);

      if (!untrack(() => this.dirty)) {
        this.search = vals.search ?? "";
      }

      this.selectedTags = vals.tags ?? [];
      this.rating = vals.rating;
      this.ratingOp = vals.ratingOp ?? "gte";
      this.sort = vals.sort ?? "committedAt";
      this.order = vals.order ?? "desc";
    });
  }

  // ---

  /** 根據目前篩選狀態構建 query string */
  #currentQueryString(): string {
    return buildQueryString({
      search: this.search,
      tags: this.selectedTags,
      rating: this.rating,
      ratingOp: this.ratingOp,
      sort: this.sort,
      order: this.order,
    });
  }

  // ---

  /** 處理搜尋輸入框 input 事件，以 debounce 方式觸發 URL 導航 */
  handleSearchInput = () => {
    this.dirty = true;
    if (this.#searchTimer) clearTimeout(this.#searchTimer);
    this.#searchTimer = setTimeout(() => {
      this.dirty = false;
      goto(`/editor${this.#currentQueryString()}`, { replaceState: true, noScroll: true, keepFocus: true });
    }, 300);
  };

  /** 處理篩選條件變更事件，立即觸發 URL 導航 */
  handleFilterChange = () => {
    goto(`/editor${this.#currentQueryString()}`, { replaceState: true, noScroll: true, keepFocus: true });
  };
}
