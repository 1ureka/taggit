/**
 * @file query.svelte.ts
 * 管理篩選與排序條件，以及同步對應的 URL 查詢參數
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { ImageQuery } from "$lib/query-spec";
import { syncedQuery } from "$lib/utils/search-params.svelte";
import { addToast } from "$lib/components/floating/toast-events";

class QueryController {
  private synced = syncedQuery((params) => ImageQuery.fromSearchParams(params));

  /** 目前的圖片查詢條件 */
  get query(): ImageQuery {
    return this.synced.value;
  }

  /** 進階篩選作用中的條件數，用於開啟進階篩選按鈕的顯示徽章 */
  advancedCount = $derived.by(() => {
    const { where } = this.query;
    return (
      (where.includedTags.length > 0 ? 1 : 0) +
      (where.excludedTags.length > 0 ? 1 : 0) +
      (where.rating !== undefined ? 1 : 0)
    );
  });

  /** 目前篩選條件對應的標籤切片查詢範圍，供標籤輸入框查詢可用標籤（包含批次「去標籤」面板） */
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

  // ---

  /** 是否有一次重新整理正在進行中 */
  refreshing = $state(false);

  /** 重新整理，條件不變，用同一組查詢再問伺服器一次 */
  handleRefresh = async () => {
    if (this.refreshing) return;

    this.refreshing = true;
    await new Promise((resolve) => setTimeout(resolve, 200)); // debounce

    try {
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
      addToast({ message: "列表已更新", variant: "success" });
    } catch (e) {
      addToast({ message: "重新整理失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.refreshing = false;
    }
  };
}

const key = Symbol("query-controller");

export const createQueryContext = () => {
  const controller = new QueryController();
  setContext(key, controller);
  return controller;
};

export const getQueryContext = () => getContext<QueryController>(key);
