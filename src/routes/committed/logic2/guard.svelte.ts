/**
 * @file guard.ts
 * 離頁守衛：drafts 跟 reverts 誰有未處理的東西都要攔，兩者互不知道對方，這裡才是該合起來問的地方
 */

import type { BeforeNavigate } from "@sveltejs/kit";
import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";

import { getOperationsContext } from "../logic/operations.svelte";
import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";

class GuardController {
  private operations = getOperationsContext();
  private drafts = getDraftsContext();
  private reverts = getRevertMarkContext();

  private get pendingCount() {
    return this.drafts.touchedFiles.length + this.reverts.markedFiles.length;
  }

  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;

    const to = nav.to;
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return; // 自身的同址 goto with invalidate 不攔

    if (this.operations.pending) {
      nav.cancel();
      addToast({ message: "操作進行中，請稍候", variant: "info" });
      return;
    }

    if (this.pendingCount === 0) return;

    nav.cancel();
    if (to === null) return;

    const msg = `還有 ${this.pendingCount} 張圖片的變更尚未提交，離開將會遺失這些修改。確定要離開？`;
    requestConfirm(msg, { title: "尚未提交的變更", action: "離開" }).then((confirmed) => {
      if (!confirmed) return;
      this.drafts.handleDiscardAll();
      this.reverts.handleUnmarkAll();
      goto(to.url.href);
    });
  };

  handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.pendingCount > 0 || this.operations.pending) {
      e.preventDefault();
      e.returnValue = "";
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
