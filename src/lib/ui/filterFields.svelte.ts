import { page } from "$app/state";
import { goto } from "$app/navigation";
import { parseQueryParams, buildQueryString } from "$lib/database/client.js";
import type { SortField } from "$lib/database/client.js";
import { debounce } from "$lib/utils.js";

/**
 * 實時篩選表單的互動邏輯
 */
export class FilterFields {
  /** 搜尋關鍵字 */
  search: string;
  /** 要包含的標籤 */
  includedTags: string[];
  /** 要排除的標籤 */
  excludedTags: string[];
  /** 評等篩選值 */
  rating: number | undefined;
  /** 評等比較運算子 */
  ratingOp: "gte" | "lte" | "eq";
  /** 排序欄位 */
  sort: SortField;
  /** 排序方向 */
  order: "asc" | "desc";

  constructor() {
    const params = () => parseQueryParams(page.url);

    this.search = $derived(params().search ?? "");
    this.includedTags = $derived(params().includedTags ?? []);
    this.excludedTags = $derived(params().excludedTags ?? []);
    this.rating = $derived(params().rating);
    this.ratingOp = $derived(params().ratingOp ?? "gte");
    this.sort = $derived(params().sort ?? "rating");
    this.order = $derived(params().order ?? "desc");
  }

  // ---

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
