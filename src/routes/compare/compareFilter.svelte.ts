import { page } from "$app/state";
import { goto } from "$app/navigation";
import { untrack } from "svelte";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";

/**
 * CompareFilter 的互動邏輯
 */
export class CompareFilter {
  /** 篩選標籤 */
  filterTags = $state<string[]>([]);
  /** 最低評等篩選值 */
  filterMinRating = $state(0);

  constructor() {
    const init = untrack(() => parseQueryParams(page.url));
    this.filterTags = init.tags ?? [];
    this.filterMinRating = init.rating ?? 0;

    $effect(() => {
      const params = parseQueryParams(page.url);
      this.filterTags = params.tags ?? [];
      this.filterMinRating = params.rating ?? 0;
    });
  }

  /** 處理篩選變更事件，以 goto() 導航觸發 SSR 重跑 */
  handleFilterChange = () => {
    const qs = buildQueryString({
      tags: this.filterTags,
      rating: this.filterMinRating > 0 ? this.filterMinRating : undefined,
    });

    goto(`/compare${qs}`, { replaceState: true, noScroll: true, keepFocus: true });
  };
}
