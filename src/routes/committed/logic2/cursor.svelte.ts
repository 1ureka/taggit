/**
 * @file cursor.svelte.ts
 * 目前正在檢視/編輯哪個檔案：跟 URL 的 currentId 同步
 */

import { getContext, setContext, untrack } from "svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/state";

import { getPageDataContext } from "../logic/page-data.svelte";

class CursorController {
  private pageData = getPageDataContext();

  private get files() {
    return this.pageData.value.items.map((r) => r.id);
  }

  private echo = untrack(() => page.url.searchParams.get("currentId"));
  private activeState = $state(this.echo);

  /** 目前正在檢視/編輯的檔案；篩選/排序改變導致它不在可視範圍時自動回落為 null */
  activeFile = $derived(this.activeState !== null && this.files.includes(this.activeState) ? this.activeState : null);
  /** 目前檔案在目前篩選結果內的指標（1-based，沒有選取時為 0） */
  activeIndex = $derived(this.activeFile !== null ? this.files.indexOf(this.activeFile) + 1 : 0);

  constructor() {
    $effect(() => {
      // 上一頁/下一頁或其他外部原因造成 URL 的 currentId 參數變動時
      const urlId = page.url.searchParams.get("currentId");
      if (urlId !== this.echo) this.activeState = urlId;
      this.echo = urlId;
    });
  }

  private commit(id: string | null) {
    this.activeState = id;
    this.echo = id;
    const params = new URLSearchParams(location.search); // 不是 page.url，理由見 docs/svelte_kit_routes.md
    if (id) params.set("currentId", id);
    else params.delete("currentId");
    const qs = params.toString();
    replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
  }

  /** 開啟指定檔名的編輯面板 */
  handleSelect = (filename: string) => {
    this.commit(filename);
  };

  /** 關閉編輯面板 */
  handleClose = () => {
    if (this.activeState === null) return;
    this.commit(null);
  };
}

const key = Symbol("cursor-controller");

export const createCursorContext = () => {
  const controller = new CursorController();
  setContext(key, controller);
  return controller;
};

export const getCursorContext = () => getContext<CursorController>(key);
