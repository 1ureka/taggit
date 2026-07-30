/**
 * @file query.svelte.ts
 * 管理標籤池的查詢條件與 URL 同步
 */

import { getContext, setContext } from "svelte";
import { navigating } from "$app/state";
import { TagQuery } from "$lib/query-spec";
import { SvelteSearchParams } from "$lib/utils/search-params.svelte";
import { getPageDataContext } from "./page-data.svelte";

class QueryController {
  private pageData = getPageDataContext();
  private params = new SvelteSearchParams<TagQuery>({
    parse: (params) => TagQuery.fromSearchParams(params),
    serialize: (value, base) => value.toSearchParams(base),
  });

  /** 目前的標籤查詢條件 */
  get query(): TagQuery {
    return this.params.value;
  }

  /** 目前所在頁面 */
  page = $derived(this.pageData.value.page);
  /** 目前頁面總數 */
  pages = $derived(this.pageData.value.pages);
  /** 目前項目總數 */
  total = $derived(this.pageData.value.total);
  /** 是否有導航在途，換頁控制項據此避免連點 */
  navigating = $derived(!!navigating.to);
  /** 是否已在首頁 */
  atFirst = $derived(this.page <= 1);
  /** 是否已在末頁 */
  atLast = $derived(this.page >= this.pages);

  private commit(next: TagQuery) {
    this.params.set(next);
  }

  /** 處理搜尋；篩選條件變動一律把頁碼重置為 1 */
  handleSearch = (name: string) => {
    this.commit(new TagQuery(this.query.where.with({ name }), this.query.list.with({ page: 1 })));
  };

  /** 處理排序欄位改變 */
  handleSortChange = (key: string) => {
    if (key !== "count" && key !== "name") return;
    this.commit(new TagQuery(this.query.where, this.query.list.with({ sort: key, page: 1 })));
  };

  /** 處理隱藏篩選改變 */
  handleHiddenFilterChange = (key: string) => {
    if (key !== "all" && key !== "hidden" && key !== "visible") return;
    const hidden = key === "all" ? undefined : key === "hidden";
    this.commit(new TagQuery(this.query.where.with({ hidden }), this.query.list.with({ page: 1 })));
  };

  /** 換到指定頁，超出範圍由內部夾住 */
  private gotoPage(p: number) {
    const next = Math.min(Math.max(1, p), this.pages);
    if (next === this.page) return;
    this.commit(new TagQuery(this.query.where, this.query.list.with({ page: next })));
  }

  handleFirstPage = () => {
    this.gotoPage(1);
  };

  handlePrevPage = () => {
    this.gotoPage(this.page - 1);
  };

  handleNextPage = () => {
    this.gotoPage(this.page + 1);
  };

  handleLastPage = () => {
    this.gotoPage(this.pages);
  };
}

const key = Symbol("query-controller");

export const createQueryContext = () => {
  const controller = new QueryController();
  setContext(key, controller);
  return controller;
};

export const getQueryContext = () => getContext<QueryController>(key);
