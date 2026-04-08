import { page } from "$app/state";
import { goto } from "$app/navigation";
import { untrack } from "svelte";
import { parseQueryParams, buildQueryString, debounce } from "$lib/utils.js";
import type { QueryOptions, SortField } from "$lib/types";

/**
 * 實時篩選表單的互動邏輯
 */
export class FilterFields {
  /** 搜尋關鍵字 */
  search = $state<string>("");
  /** 要包含的標籤 */
  includedTags = $state<string[]>([]);
  /** 要排除的標籤 */
  excludedTags = $state<string[]>([]);
  /** 評等篩選值 */
  rating = $state<number | undefined>(undefined);
  /** 評等比較運算子 */
  ratingOp = $state<"gte" | "lte" | "eq">("gte");
  /** 排序欄位 */
  sort = $state<SortField>("rating");
  /** 排序方向 */
  order = $state<"asc" | "desc">("desc");

  constructor() {
    this.#setFields(untrack(() => parseQueryParams(page.url)));

    $effect(() => {
      this.#setFields(parseQueryParams(page.url));
    });
  }

  // ---

  /** 根據提供的選項重置欄位 */
  #setFields(opts: QueryOptions) {
    this.search = opts.search ?? "";
    this.includedTags = opts.includedTags ?? [];
    this.excludedTags = opts.excludedTags ?? [];
    this.rating = opts.rating;
    this.ratingOp = opts.ratingOp ?? "gte";
    this.sort = opts.sort ?? "rating";
    this.order = opts.order ?? "desc";
  }

  /** 取得目前的查詢字串 */
  #getQueryString(): string {
    const options = {
      search: this.search,
      includedTags: this.includedTags,
      excludedTags: this.excludedTags,
      rating: this.rating,
      ratingOp: this.ratingOp,
      sort: this.sort,
      order: this.order,
    };

    return buildQueryString(options, new URLSearchParams(page.url.searchParams));
  }

  #goto() {
    goto(`${page.url.pathname}${this.#getQueryString()}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  // ---

  /** 處理所有條件變更事件，除了搜尋關鍵字，立即觸發 URL 導航 */
  handleChange = () => {
    this.#goto();
  };

  /** 處理搜尋關鍵字變更事件，延遲觸發 URL 導航 */
  handleSearchChange = debounce(this.handleChange, 500);
}
