/**
 * @file query.svelte.ts
 * 管理標籤篩選（搜尋/排序/隱藏）與分頁——統一成同一個 SvelteSearchParams，只有一個 set 點，
 * 篩選條件改變一律連帶把頁碼重置為 1；目前頁/總頁數以伺服器回傳（page-data）為準，不在前端重算。
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

  /** 以下三者一律以伺服器回傳為準，不在前端重算 */
  currentPage = $derived(this.pageData.value.page);
  totalPages = $derived(this.pageData.value.pages);
  total = $derived(this.pageData.value.total);

  private navigatingAway = $derived(!!navigating.to);
  disabledFirst = $derived(this.navigatingAway || this.currentPage <= 1);
  disabledPrev = $derived(this.navigatingAway || this.currentPage <= 1);
  disabledNext = $derived(this.navigatingAway || this.currentPage >= this.totalPages);
  disabledLast = $derived(this.navigatingAway || this.currentPage >= this.totalPages);

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

  private gotoPage(p: number) {
    this.commit(new TagQuery(this.query.where, this.query.list.with({ page: p })));
  }

  handleFirstPage = () => {
    if (!this.disabledFirst) this.gotoPage(1);
  };
  handlePrevPage = () => {
    if (!this.disabledPrev) this.gotoPage(this.currentPage - 1);
  };
  handleNextPage = () => {
    if (!this.disabledNext) this.gotoPage(this.currentPage + 1);
  };
  handleLastPage = () => {
    if (!this.disabledLast) this.gotoPage(this.totalPages);
  };
}

const key = Symbol("query-controller");

export const createQueryContext = () => {
  const controller = new QueryController();
  setContext(key, controller);
  return controller;
};

export const getQueryContext = () => getContext<QueryController>(key);
