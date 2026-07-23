/**
 * @file detail.ts
 * 管理詳情彈窗目前開啟的圖片，並將其同步為 URL 查詢參數（shallow routing，不觸發 load 重跑）
 */

import { getContext, setContext, untrack } from "svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/state";
import { getPageDataContext } from "./page-data.svelte";
import { getFilterContext } from "./filter.svelte";

class DetailController {
  private pageData = getPageDataContext();
  private filter = getFilterContext();

  private echo = untrack(() => page.url.searchParams.get("modal"));
  private idState = $state(this.echo);

  /** 目前開啟中的詳情圖片；null 代表關閉，或該 id 已不在目前結果集內 */
  record = $derived(this.pageData.value.items.find((item) => item.id === this.idState) ?? null);

  /** 前往編輯紀錄的連結，帶上當下的篩選參數，使有隱藏標籤的圖片才不會在新頁面被再次遮蔽 */
  href = $derived.by(() => {
    if (!this.record) return "/committed";
    const params = this.filter.query.toSearchParams();
    params.set("currentId", this.record.id);
    return `/committed?${params.toString()}`;
  });

  constructor() {
    // 上一頁/下一頁或其他外部原因造成 URL 的 modal 參數變動時
    $effect(() => {
      const urlId = page.url.searchParams.get("modal");
      if (urlId !== this.echo) this.idState = urlId;
      this.echo = urlId;
    });
  }

  private commit(id: string | null) {
    this.idState = id;
    this.echo = id;
    const params = new URLSearchParams(location.search);
    if (id) params.set("modal", id);
    else params.delete("modal");
    const qs = params.toString();
    replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
  }

  /** 開啟指定 id 圖片的詳情 */
  handleSelect = (id: string) => {
    this.commit(id);
  };

  /** 關閉詳情 */
  handleClose = () => {
    if (this.idState === null) return; // 確保真的有打開，才允許關閉
    this.commit(null);
  };
}

const key = Symbol("detail-controller");

export const createDetailContext = () => {
  const controller = new DetailController();
  setContext(key, controller);
  return controller;
};

export const getDetailContext = () => getContext<DetailController>(key);
