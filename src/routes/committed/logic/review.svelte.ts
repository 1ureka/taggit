/**
 * @file review.svelte.ts
 * 審查清單的狀態管理，包括開闔、分批、勾選、可送出判斷、觸發提交
 */

import { getContext, setContext } from "svelte";
import { SveltePagination } from "$lib/utils/pagination.svelte";

import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";
import { getSubmitContext } from "./submit.svelte";

class ReviewController {
  private drafts = getDraftsContext();
  private reverts = getRevertMarkContext();
  private submit = getSubmitContext();

  /** 全部有暫存操作的檔案，維持插入順序 */
  private files = $derived([...new Set([...this.drafts.touchedFiles, ...this.reverts.markedFiles])]);
  /** 一輪能承擔的審查量設為 25 ，因圖片的差異比對繁複，更高的量等於沒審查 */
  private pagination = new SveltePagination(() => this.files, 25);
  /** 目前審查清單的勾選狀態；每次開始新的一批時重新全選可提交項目 */
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
  /** 全部待提交的檔案數，不受分批截斷 */
  totalCount = $derived(this.pagination.total);
  /** 目前批次（1-based） */
  batch = $derived(this.pagination.page);
  /** 總批次數 */
  batches = $derived(this.pagination.pages);
  /** 本批負責的檔案，以下所有衍生值都以它為事實來源 */
  batchFiles = $derived(this.pagination.items);
  /** 可送出的檔案 */
  checkableFiles = $derived(this.batchFiles.filter((f) => this.checkableOf(f)));
  /** 可送出的數量 */
  checkableCount = $derived(this.checkableFiles.length);
  /** 已勾選且可送出的檔案 */
  submittableFiles = $derived(this.batchFiles.filter((f) => this.checked[f] && this.checkableOf(f)));
  /** 已勾選且可送出的張數 */
  submittableCount = $derived(this.submittableFiles.length);
  /** 全選框的三態 */
  bulkSelectionState = $derived.by(() => {
    if (this.checkableCount === 0 || this.submittableCount === 0) return "unchecked" as const;
    if (this.checkableCount === this.submittableCount) return "checked" as const;
    return "indeterminate" as const;
  });

  /** 換到指定批次，超出範圍由分頁自行夾住，呼叫端不需要判斷邊界 */
  private moveTo(batch: number) {
    if (this.submit.pending) return;

    this.pagination.set(batch);

    const checked: Record<string, true> = {};
    for (const f of this.pagination.items) {
      if (this.checkableOf(f)) checked[f] = true;
    }

    this.checked = checked;
  }

  /** 開啟審查清單，從第一批開始 */
  handleOpen = () => {
    this.submit.clearFailures();
    this.moveTo(1);
    this.open = true;
  };

  /** 關閉審查清單（提交進行中時不允許關閉） */
  handleClose = () => {
    if (!this.submit.pending) this.open = false;
  };

  /** 回到首批 */
  handleFirstBatch = () => {
    this.moveTo(1);
  };

  /** 前往上一批 */
  handlePrevBatch = () => {
    this.moveTo(this.batch - 1);
  };

  /** 前往下一批 */
  handleNextBatch = () => {
    this.moveTo(this.batch + 1);
  };

  /** 前往最後一批 */
  handleLastBatch = () => {
    this.moveTo(this.batches);
  };

  /** 切換單一項目的勾選狀態 */
  handleToggle = (filename: string) => {
    if (this.checked[filename]) delete this.checked[filename];
    else this.checked[filename] = true;
  };

  /** 全選／全不選本批目前可勾選的項目 */
  handleToggleAll = () => {
    const eligible = this.checkableFiles;
    const allSelected = eligible.length > 0 && eligible.every((f) => this.checked[f]);
    for (const f of eligible) {
      if (allSelected) delete this.checked[f];
      else this.checked[f] = true;
    }
  };

  /** 提交本批可送出的項目；成功的會被 submit 自己清掉，這裡只負責同步 checked 狀態 */
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
