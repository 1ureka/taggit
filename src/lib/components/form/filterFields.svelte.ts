import { page } from "$app/state";
import { goto } from "$app/navigation";
import { ImageQuery, ImageWhere, ListOptions } from "$lib/poc/query-spec";
import type { ImageSort } from "$lib/poc/query-spec";
import { debounce } from "$lib/utils/shared.js";

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
  sort: ImageSort;
  /** 排序方向 */
  order: "asc" | "desc";

  constructor() {
    const query = () => ImageQuery.fromSearchParams(page.url.searchParams);

    this.search = $derived(query().where.search);
    this.includedTags = $derived(query().where.includedTags);
    this.excludedTags = $derived(query().where.excludedTags);
    this.rating = $derived(query().where.rating);
    this.ratingOp = $derived(query().where.ratingOp);
    this.sort = $derived(query().list.sort);
    this.order = $derived(query().list.order);
  }

  // ---

  /** 由目前欄位組出查詢值物件，再與頁面自有參數合併成查詢字串（值物件自行清掉舊查詢鍵、保留頁面自有參數） */
  #getQueryString(): string {
    const where = new ImageWhere({
      search: this.search,
      includedTags: this.includedTags,
      excludedTags: this.excludedTags,
      rating: this.rating,
      ratingOp: this.ratingOp,
    });
    const list = new ListOptions<ImageSort>({ sort: this.sort, order: this.order });
    const params = new ImageQuery(where, list).toSearchParams(page.url.searchParams);

    const qs = params.toString();
    return qs ? `?${qs}` : "";
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
