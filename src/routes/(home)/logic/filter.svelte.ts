/**
 * @file filter.ts
 * 管理篩選與排序條件，以及同步對應的 URL 查詢參數
 */

import { getContext, setContext } from "svelte";
import { ImageQuery, ImageWhere } from "$lib/query-spec";
import { syncedQuery } from "$lib/utils/search-params.svelte";

class FilterController {
  private synced = syncedQuery((params) => ImageQuery.fromSearchParams(params));

  /** 目前的圖片查詢條件 */
  get query(): ImageQuery {
    return this.synced.value;
  }

  /** 目前篩選條件對應的標籤切片查詢範圍，供標籤輸入框查詢可用標籤 */
  facetScope = $derived(this.query.where.toSearchParams().toString());

  private commit(next: ImageQuery) {
    this.synced.commit(next);
  }

  /** 處理關鍵字搜尋 */
  handleSearch = (search: string) => {
    this.commit(new ImageQuery(this.query.where.with({ search }), this.query.list));
  };

  /** 處理排序種類改變 */
  handleSortChange = (key: string) => {
    if (key === "committedAt" || key === "rating" || key === "name" || key === "random") {
      this.commit(new ImageQuery(this.query.where, this.query.list.with({ sort: key })));
    }
  };

  /** 處理排序方向改變 */
  handleOrderChange = (key: string) => {
    if (key === "desc" || key === "asc") {
      this.commit(new ImageQuery(this.query.where, this.query.list.with({ order: key })));
    }
  };

  /** 處理評等改變 */
  handleRatingChange = (key: string) => {
    const rating = key === "all" ? undefined : Number(key);
    this.commit(new ImageQuery(this.query.where.with({ rating }), this.query.list));
  };

  /** 處理評等方向改變 */
  handleRatingOpChange = (key: string) => {
    if (key === "gte" || key === "lte" || key === "eq") {
      this.commit(new ImageQuery(this.query.where.with({ ratingOp: key }), this.query.list));
    }
  };

  /** 處理標籤篩選改變 */
  handleTagsChange = (type: "includedTags" | "excludedTags", tags: string[]) => {
    this.commit(new ImageQuery(this.query.where.with({ [type]: tags }), this.query.list));
  };

  /** 由詳情彈窗點擊標籤觸發：重置所有篩選/排序條件，只保留該標籤作為包含篩選 */
  handleQuickFilter = (tag: string) => {
    this.commit(new ImageQuery(new ImageWhere({ includedTags: [tag] })));
  };
}

const key = Symbol("filter-controller");

export const createFilterContext = () => {
  const controller = new FilterController();
  setContext(key, controller);
  return controller;
};

export const getFilterContext = () => getContext<FilterController>(key);
