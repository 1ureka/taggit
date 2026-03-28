import { goto } from "$app/navigation";
import { page } from "$app/state";
import { untrack } from "svelte";
import { parseQueryParams, buildQueryString, debounce } from "$lib/utils.js";
import type { QueryOptions } from "$lib/types";

/**
 * 篩選表單的互動邏輯
 */
export class ScrollForm {
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
  sort = $state<"committedAt" | "rating" | "name" | "random">("committedAt");
  /** 排序方向 */
  order = $state<"asc" | "desc">("desc");
  /** 查詢字串 */
  queryString: string;

  constructor() {
    this.queryString = $derived(this.#getQueryString());

    this.#resetFields(untrack(() => parseQueryParams(page.url)));

    $effect(() => {
      this.#resetFields(parseQueryParams(page.url));
    });
  }

  // ---

  /** 根據提供的選項重置欄位 */
  #resetFields(opts: QueryOptions) {
    this.search = opts.search ?? "";
    this.includedTags = opts.includedTags ?? [];
    this.excludedTags = opts.excludedTags ?? [];
    this.rating = opts.rating;
    this.ratingOp = opts.ratingOp ?? "gte";
    this.sort = opts.sort ?? "committedAt";
    this.order = opts.order ?? "desc";
  }

  /** 取得目前的查詢字串 */
  #getQueryString(): string {
    return buildQueryString({
      search: this.search,
      includedTags: this.includedTags,
      excludedTags: this.excludedTags,
      rating: this.rating,
      ratingOp: this.ratingOp,
      sort: this.sort,
      order: this.order,
    });
  }

  // ---

  /** 處理所有條件變更事件，除了搜尋關鍵字，立即觸發 URL 導航 */
  handleChange = () => {
    goto(`/scroll${this.queryString}`, { replaceState: true, noScroll: true, keepFocus: true });
  };

  /** 處理搜尋關鍵字變更事件，延遲觸發 URL 導航 */
  handleSearchChange = debounce(this.handleChange, 500);
}
