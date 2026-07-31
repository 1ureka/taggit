/**
 * @file guard.svelte.ts
 * 管理離頁守衛
 */

import type { BeforeNavigate } from "@sveltejs/kit";
import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";

import { getZonesContext } from "./zones.svelte";
import { getSubmitContext } from "./submit.svelte";
import { getQueryContext } from "./query.svelte";
import { getReviewContext } from "./review.svelte";

class GuardController {
  private zones = getZonesContext();
  private submit = getSubmitContext();
  private query = getQueryContext();
  private review = getReviewContext();

  /** 會真的改動資料或重跑查詢的操作是否進行中 */
  private get busy() {
    return this.submit.pending || this.query.refreshing;
  }

  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;

    const to = nav.to;
    // 判斷來源頁必須用 page.url，popstate 時 location 已經是目標頁
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return; // 同頁的換頁／篩選 goto 不攔

    if (this.busy) {
      nav.cancel(); // 避免 in-flight 續跑在新頁面上產生跨頁副作用
      addToast({ message: "操作進行中，請稍候", variant: "info" });
      return;
    }

    if (this.review.totalCount === 0) return;

    nav.cancel();
    if (to === null) return;

    const msg = `還有 ${this.review.totalCount} 筆標籤操作尚未送出，離開將會遺失這些排程。確定要離開？`;
    requestConfirm(msg, { title: "尚未送出的標籤操作", action: "離開" }).then((confirmed) => {
      if (!confirmed) return;
      this.zones.handleClearAll();
      goto(to.url.href);
    });
  };

  handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.review.totalCount > 0 || this.busy) {
      e.preventDefault();
      e.returnValue = ""; // 部分瀏覽器需一併設定才會顯示離開確認
    }
  };
}

const key = Symbol("guard-controller");

export const createGuardContext = () => {
  const controller = new GuardController();
  setContext(key, controller);
  return controller;
};

export const getGuardContext = () => getContext<GuardController>(key);
