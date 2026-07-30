/**
 * @file query.svelte.ts
 * 管理標籤池的查詢，包括篩選條件、分頁、URL 同步與重新查詢
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { TagQuery } from "$lib/query-spec";
import { SvelteSearchParams } from "$lib/utils/search-params.svelte";
import { addToast } from "$lib/components/floating/toast-events";
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

  /** 目前所在頁面；換頁時由 `gotoPage` 樂觀覆寫，導航完成後回落為伺服器值 */
  page = $derived(this.pageData.value.page);
  /** 目前頁面總數 */
  pages = $derived(this.pageData.value.pages);
  /** 目前項目總數 */
  total = $derived(this.pageData.value.total);
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

  /**
   * 換到指定頁，超出範圍由內部夾住，呼叫端不需要判斷邊界。
   *
   * 覆寫 `page` 是為了讓連續點擊能各自基於前一次的意圖換算——導航在途時 `pageData`
   * 還是舊值，不覆寫的話連按三次「下一頁」會三次都算出同一頁。夾制先於覆寫，
   * 因此覆寫值永遠落在伺服器實際會回傳的範圍內。
   */
  private gotoPage(p: number) {
    const next = Math.min(Math.max(1, p), this.pages);
    if (next === this.page) return;

    this.page = next;
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

  // ---

  /** 是否有一次重新整理正在進行中 */
  refreshing = $state(false);
  /** 每次重新整理後遞增，供依賴標籤庫內容的快取判斷是否失效 */
  revision = $state(0);

  /** 重新整理，條件不變再次查詢 */
  handleRefresh = async () => {
    if (this.refreshing) return;

    this.refreshing = true;
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
      this.revision++;
      addToast({ message: "標籤列表已更新", variant: "success" });
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
