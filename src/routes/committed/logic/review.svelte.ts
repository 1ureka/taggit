/**
 * @file review.svelte.ts
 * 審查清單的狀態管理，包括開闔、勾選、可送出判斷、觸發提交
 */

import { getContext, setContext } from "svelte";

import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";
import { getSubmitContext } from "./submit.svelte";
import { getPointersContext } from "./pointers.svelte";

class ReviewController {
  private drafts = getDraftsContext();
  private reverts = getRevertMarkContext();
  private submit = getSubmitContext();
  private pointers = getPointersContext();

  /** 目前審查清單的勾選狀態；每次打開時重新全選可提交項目 */
  private checked = $state<Record<string, true>>({});

  /** 指定檔名目前是否可以被送出 */
  checkableOf(filename: string): boolean {
    if (this.reverts.isMarked(filename)) return true;
    return this.drafts.problemOf(filename) === null;
  }
  /** 指定檔名目前是否已勾選 */
  isChecked(filename: string): boolean {
    return !!this.checked[filename];
  }

  /** 審查對話框是否開啟 */
  open = $state(false);
  /** 有暫存操作的檔案 */
  touchedFiles = $derived([...new Set([...this.drafts.touchedFiles, ...this.reverts.markedFiles])]);
  /** 可送出的檔案 */
  checkableFiles = $derived(this.touchedFiles.filter((f) => this.checkableOf(f)));
  /** 可送出的數量 */
  checkableCount = $derived(this.checkableFiles.length);
  /** 已勾選且可送出的檔案 */
  submittableFiles = $derived(this.touchedFiles.filter((f) => this.checked[f] && this.checkableOf(f)));
  /** 已勾選且可送出的張數 */
  submittableCount = $derived(this.submittableFiles.length);
  /** 全選框的三態 */
  bulkSelectionState = $derived.by(() => {
    if (this.checkableCount === 0 || this.submittableCount === 0) return "unchecked" as const;
    if (this.checkableCount === this.submittableCount) return "checked" as const;
    return "indeterminate" as const;
  });

  /** 開啟審查清單，並全選所有目前可提交的項目 */
  handleOpen = () => {
    this.submit.clearFailures();
    this.checked = {};
    this.open = true;
    for (const f of this.touchedFiles) {
      if (this.checkableOf(f)) this.checked[f] = true;
    }
  };

  /** 關閉審查清單（提交進行中時不允許關閉） */
  handleClose = () => {
    if (!this.submit.pending) this.open = false;
  };

  /** 切換單一項目的勾選狀態 */
  handleToggle = (filename: string) => {
    if (this.checked[filename]) delete this.checked[filename];
    else this.checked[filename] = true;
  };

  /** 全選／全不選目前可勾選的項目 */
  handleToggleAll = () => {
    const eligible = this.checkableFiles;
    const allSelected = eligible.length > 0 && eligible.every((f) => this.checked[f]);
    for (const f of eligible) {
      if (allSelected) delete this.checked[f];
      else this.checked[f] = true;
    }
  };

  /** 從審查清單回到某張圖片繼續編輯 */
  handleEdit = (filename: string) => {
    this.open = false;
    this.pointers.handleSelect(filename);
  };

  /** 提交目前可送出的項目；成功的會被 submit 自己清掉，這裡只負責同步 checked 狀態 */
  handleSubmit = async () => {
    const filenames = this.submittableFiles;
    await this.submit.handleSubmit(filenames);

    const failures = this.submit.lastFailures;
    for (const f of filenames) if (!(f in failures)) delete this.checked[f];
    if (Object.keys(failures).length === 0) this.open = false;
  };
}

const key = Symbol("review-controller");

export const createReviewContext = () => {
  const controller = new ReviewController();
  setContext(key, controller);
  return controller;
};

export const getReviewContext = () => getContext<ReviewController>(key);
