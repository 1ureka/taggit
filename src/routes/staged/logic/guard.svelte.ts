/**
 * @file guard.svelte.ts
 * 管理離頁守衛
 */

import { getContext, setContext } from "svelte";

import { NavigationGuard } from "$lib/utils/guard.svelte";

import { getDraftsContext } from "./drafts.svelte";
import { getSubmitContext } from "./submit.svelte";
import { getDeletionContext } from "./deletion.svelte";
import { getImportContext } from "./import.svelte";
import { getReviewContext } from "./review.svelte";

const key = Symbol("guard-controller");

export const createGuardContext = () => {
  const drafts = getDraftsContext();
  const submit = getSubmitContext();
  const deletion = getDeletionContext();
  const importer = getImportContext();
  const review = getReviewContext();

  const controller = new NavigationGuard({
    busy: () => submit.pending || deletion.pending || importer.pending,
    count: () => review.totalCount,
    title: "尚未提交的變更",
    message: (n) => `還有 ${n} 張圖片的暫存尚未提交，離開將會遺失這些修改。確定要離開？`,
    discard: () => drafts.handleDiscardAll(),
  });

  setContext(key, controller);
  return controller;
};

export const getGuardContext = () => getContext<NavigationGuard>(key);
