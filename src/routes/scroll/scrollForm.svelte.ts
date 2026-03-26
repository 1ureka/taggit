import { goto } from "$app/navigation";
import { page } from "$app/state";
import { untrack } from "svelte";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";

/**
 * 篩選表單的互動邏輯
 */
export class ScrollForm {
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

  constructor() {
    const init = untrack(() => parseQueryParams(page.url));
    this.selectedTags = init.includedTags ?? [];
    this.rating = init.rating;
    this.ratingOp = init.ratingOp ?? "gte";
    this.sort = init.sort ?? "committedAt";
    this.order = init.order ?? "desc";

    $effect(() => {
      const vals = parseQueryParams(page.url);
      this.selectedTags = vals.includedTags ?? [];
      this.rating = vals.rating;
      this.ratingOp = vals.ratingOp ?? "gte";
      this.sort = vals.sort ?? "committedAt";
      this.order = vals.order ?? "desc";
    });
  }

  // ---

  #currentQueryString(): string {
    return buildQueryString({
      includedTags: this.selectedTags,
      rating: this.rating,
      ratingOp: this.ratingOp,
      sort: this.sort,
      order: this.order,
    });
  }

  // ---

  /** 處理篩選條件變更事件，立即觸發 URL 導航 */
  handleFilterChange = () => {
    goto(`/scroll${this.#currentQueryString()}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  };
}
