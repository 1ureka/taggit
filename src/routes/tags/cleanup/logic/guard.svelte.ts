/**
 * @file guard.svelte.ts
 * 管理離頁守衛
 */

import { getContext, setContext } from "svelte";

import { NavigationGuard } from "$lib/utils/guard.svelte";

import { getScheduleContext } from "./schedule.svelte";
import { getSubmitContext } from "./submit.svelte";
import { getQueryContext } from "./query.svelte";
import { getReviewContext } from "./review.svelte";

const key = Symbol("guard-controller");

export const createGuardContext = () => {
  const schedule = getScheduleContext();
  const submit = getSubmitContext();
  const query = getQueryContext();
  const review = getReviewContext();

  const controller = new NavigationGuard({
    busy: () => submit.pending || query.refreshing,
    count: () => review.totalCount,
    title: "尚未送出的標籤操作",
    message: (n) => `還有 ${n} 筆標籤操作尚未送出，離開將會遺失這些排程。確定要離開？`,
    discard: () => schedule.handleClearAll(),
  });

  setContext(key, controller);
  return controller;
};

export const getGuardContext = () => getContext<NavigationGuard>(key);
