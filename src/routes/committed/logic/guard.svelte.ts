/**
 * @file guard.svelte.ts
 * 管理離頁守衛
 */

import { getContext, setContext } from "svelte";

import { NavigationGuard } from "$lib/utils/guard.svelte";

import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";
import { getSubmitContext } from "./submit.svelte";
import { getReviewContext } from "./review.svelte";

const key = Symbol("guard-controller");

export const createGuardContext = () => {
  const submit = getSubmitContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();
  const review = getReviewContext();

  const controller = new NavigationGuard({
    busy: () => submit.pending,
    count: () => review.totalCount,
    title: "尚未提交的變更",
    message: (n) => `還有 ${n} 張圖片的變更尚未提交，離開將會遺失這些修改。確定要離開？`,
    discard: () => {
      drafts.handleDiscardAll();
      reverts.handleUnmarkAll();
    },
  });

  setContext(key, controller);
  return controller;
};

export const getGuardContext = () => getContext<NavigationGuard>(key);
