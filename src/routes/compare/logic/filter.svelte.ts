/**
 * @file filter.ts
 * /compare 篩選＋排序條件的 controller。
 *
 * 原本 Filters/FilterButton/FilterPopover 各自獨立以 `$derived` 讀 `page.url.searchParams` 重建
 * `ImageQuery`，變更後各自呼叫 `goto`——互不知情，若使用者在前一次 `goto` resolve 之前又觸發下一次
 * 篩選變更，後一次呼叫會基於尚未更新的舊快照建構查詢字串、覆蓋前一次的意圖（見 issues/route_compare.md
 * 第 1 條）。這裡收斂成一份共用的本地緩衝，所有變更都經過同一個 commit 出口。
 */

import { getContext, setContext } from "svelte";
import { ImageQuery } from "$lib/query-spec";
import { syncedQuery } from "$lib/utils/search-params.svelte";

class FilterController {
  private synced = syncedQuery((params) => ImageQuery.fromSearchParams(params));

  get query(): ImageQuery {
    return this.synced.value;
  }

  /** 進階篩選作用中的條件數（標籤/評等），供 FilterButton 顯示徽章 */
  advancedCount = $derived.by(() => {
    const { where } = this.query;
    return (
      (where.includedTags.length > 0 ? 1 : 0) +
      (where.excludedTags.length > 0 ? 1 : 0) +
      (where.rating !== undefined ? 1 : 0)
    );
  });

  /** 目前篩選條件對應的 facet 查詢範圍（不含排序/分頁），供標籤輸入框查詢可用標籤 */
  facetScope = $derived.by(() => this.query.where.toSearchParams().toString());

  private commit(next: ImageQuery) {
    this.synced.commit(next);
  }

  handleSearch = (search: string) => {
    this.commit(new ImageQuery(this.query.where.with({ search }), this.query.list));
  };

  handleSortChange = (key: string) => {
    if (key === "committedAt" || key === "rating" || key === "name" || key === "random") {
      this.commit(new ImageQuery(this.query.where, this.query.list.with({ sort: key })));
    }
  };

  handleOrderChange = (key: string) => {
    if (key === "desc" || key === "asc") {
      this.commit(new ImageQuery(this.query.where, this.query.list.with({ order: key })));
    }
  };

  handleRatingChange = (key: string) => {
    const rating = key === "all" ? undefined : Number(key);
    this.commit(new ImageQuery(this.query.where.with({ rating }), this.query.list));
  };

  handleRatingOpChange = (key: string) => {
    if (key === "gte" || key === "lte" || key === "eq") {
      this.commit(new ImageQuery(this.query.where.with({ ratingOp: key }), this.query.list));
    }
  };

  handleTagsChange = (type: "includedTags" | "excludedTags", tags: string[]) => {
    this.commit(new ImageQuery(this.query.where.with({ [type]: tags }), this.query.list));
  };
}

const key = Symbol("filter-controller");

export const createFilterContext = () => {
  const controller = new FilterController();
  setContext(key, controller);
  return controller;
};

export const getFilterContext = () => getContext<FilterController>(key);
