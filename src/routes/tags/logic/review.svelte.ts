/**
 * @file review.svelte.ts
 * 審查清單：勾選狀態、投影出的清單、提交流程，以及提交失敗匯總
 */

import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { goto } from "$app/navigation";

import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

import { changesetFromOperations, submitChangeset } from "./changeset";
import { buildReviewEntries } from "./review-entry";
import { getBoardContext } from "./board.svelte";
import { getOperationsContext } from "./operations.svelte";
import { getPreviewsContext } from "./previews.svelte";

class ReviewController {
  private board = getBoardContext();
  private operationsCtx = getOperationsContext();
  private previews = getPreviewsContext();

  /** 審查對話框是否開啟 */
  open = $state(false);
  /** 上一次提交後的失敗匯總（name -> 原因） */
  private failures = $state<Record<string, string>>({});
  /** 目前審查清單的勾選狀態；每次打開時重新全選可送出項目 */
  private checked = new SvelteSet<string>();

  /** 審查清單 */
  entries = $derived(buildReviewEntries(this.board.operations, this.checked, this.failures));
  /** 已勾選的數量（只從 entries 衍生，不是原始 checked 集合的大小） */
  checkedCount = $derived(this.entries.filter((e) => e.checked).length);
  /** 可勾選的數量 */
  checkableCount = $derived(this.entries.filter((e) => e.checkable).length);
  /** 全選框的三態 */
  bulkSelectionState = $derived.by(() => {
    if (this.checkableCount === 0 || this.checkedCount === 0) return "unchecked";
    if (this.checkableCount === this.checkedCount) return "checked";
    return "indeterminate";
  });

  /** 開啟審查清單，並全選所有目前可送出的項目 */
  handleOpen = () => {
    this.failures = {};
    this.checked.clear();
    // 用空的 checked 集合先跑一次，只為了讀 checkable，不用另外重寫一次「什麼情況下不可勾選」的判斷
    const draft = buildReviewEntries(this.board.operations, new Set(), {});
    for (const e of draft) if (e.checkable) this.checked.add(e.name);
    this.open = true;
  };

  /** 關閉審查清單（操作進行中時不允許關閉） */
  handleClose = () => {
    if (!this.operationsCtx.pending) this.open = false;
  };

  /** 切換單一項目的勾選狀態 */
  handleToggle = (name: string) => {
    if (this.checked.has(name)) this.checked.delete(name);
    else this.checked.add(name);
  };

  /** 全選／全不選目前可勾選的項目 */
  handleToggleAll = () => {
    const eligible = this.entries.filter((e) => e.checkable);
    const allSelected = eligible.length > 0 && eligible.every((e) => e.checked);
    for (const e of eligible) {
      if (allSelected) this.checked.delete(e.name);
      else this.checked.add(e.name);
    }
  };

  /** 捨棄單筆操作（自畫布移除）——不需要特別處理 checked，board 不認識審查層的勾選狀態 */
  handleDiscard = (name: string) => {
    this.board.detachTag(name);
  };

  /** 提交目前勾選的操作 */
  handleSubmit = async () => {
    const names = this.entries.filter((e) => e.checked).map((e) => e.name);
    if (names.length === 0 || this.operationsCtx.pending) return;

    this.operationsCtx.pending = true;
    try {
      const cs = changesetFromOperations(this.board.operations);
      const result = await submitChangeset(cs, names);
      this.failures = Object.fromEntries(result);

      const okNames = names.filter((n) => !result.has(n));
      for (const n of okNames) {
        this.board.detachTag(n);
        this.checked.delete(n);
      }

      if (okNames.length > 0) addToast({ message: `已套用 ${okNames.length} 筆標籤操作`, variant: "success" });
      if (result.size > 0) addToast({ message: `${result.size} 筆操作失敗`, variant: "error" });
      if (result.size === 0) this.open = false;

      this.previews.clear(); // 標籤內容已變，懸停預覽快取失效
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      this.operationsCtx.pending = false;
    }
  };
}

const key = Symbol("review-controller");

export const createReviewContext = () => {
  const controller = new ReviewController();
  setContext(key, controller);
  return controller;
};

export const getReviewContext = () => getContext<ReviewController>(key);
