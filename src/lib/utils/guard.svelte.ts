/**
 * @file guard.svelte.ts
 * 攔截離開頁面的導航，在有未提交變更時先跟使用者確認的通用工具
 */

import type { BeforeNavigate } from "@sveltejs/kit";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";

/** 建立離頁守衛的設定，狀態一律以 getter 傳入，確保事件當下才讀到最新值 */
export type NavigationGuardOptions = {
  /** 會真的改動資料或重跑查詢的操作是否進行中，true 時直接擋下導航並提示稍候 */
  busy: () => boolean;
  /** 尚未提交的變更筆數，0 代表可以直接離開 */
  count: () => number;
  /** 確認對話框標題 */
  title: string;
  /** 確認訊息，收到當下的變更筆數 */
  message: (count: number) => string;
  /** 使用者確認離開後，用來清掉所有未提交的變更 */
  discard: () => void;
};

/**
 * 離頁守衛：擋住會遺失未提交變更的導航，確認後才放行
 *
 * - `handleBeforeNavigate` 交給 `beforeNavigate()`
 * - `handleBeforeUnload` 交給 `<svelte:window onbeforeunload={...} />`
 * - 兩者都只能在 `+page.svelte` 註冊
 */
export class NavigationGuard {
  private options: NavigationGuardOptions;

  constructor(options: NavigationGuardOptions) {
    this.options = options;
  }

  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;

    const to = nav.to;
    // 判斷來源頁必須用 page.url，popstate 時 location 已經是目標頁
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return; // 自身的同址 goto（換頁／篩選／重新整理）不攔

    if (this.options.busy()) {
      nav.cancel(); // 避免 in-flight 續跑在新頁面上產生跨頁副作用
      addToast({ message: "操作進行中，請稍候", variant: "info" });
      return;
    }

    const count = this.options.count();
    if (count === 0) return;

    nav.cancel();
    if (to === null) return;

    requestConfirm(this.options.message(count), { title: this.options.title, action: "離開" }).then((confirmed) => {
      if (!confirmed) return;
      this.options.discard();
      goto(to.url.href);
    });
  };

  handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.options.count() > 0 || this.options.busy()) {
      e.preventDefault();
      e.returnValue = ""; // 部分瀏覽器需一併設定才會顯示離開確認
    }
  };
}
