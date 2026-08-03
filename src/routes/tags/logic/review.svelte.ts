/**
 * @file review.svelte.ts
 * 審查清單的狀態管理，包括開闔、分批、勾選、可送出判斷、觸發送出
 */

import { getContext, setContext } from "svelte";
import { SveltePagination } from "$lib/utils/pagination.svelte";

import { getChangesetContext } from "./changeset.svelte";
import { getSubmitContext } from "./submit.svelte";

class ReviewController {
  private changeset = getChangesetContext();
  private submit = getSubmitContext();

  /** 全部有異動的標籤，維持插入順序，**不應加入任何過濾** */
  private names = $derived(this.changeset.changes.map((c) => c.name));
  /** 一輪能承擔的審查量 */
  // TODO: 標籤應該可以調整的更高
  private pagination = new SveltePagination(() => this.names, 25);
  /** 目前審查清單的勾選狀態 */
  private checked = $state<Record<string, true>>({});

  /** 指定標籤目前是否可以被送出 */
  checkableOf(name: string): boolean {
    return this.changeset.problemOf(name) === null;
  }
  /** 指定標籤目前是否已勾選 */
  isChecked(name: string): boolean {
    return !!this.checked[name];
  }

  /** 審查對話框是否開啟 */
  open = $state(false);
  /** 全部待送出的標籤數，不受分批截斷 */
  totalCount = $derived(this.pagination.total);
  /** 目前批次（1-based） */
  batch = $derived(this.pagination.page);
  /** 總批次數 */
  batches = $derived(this.pagination.pages);
  /** 本批負責的標籤 */
  batchNames = $derived(this.pagination.items);
  /** 可送出的標籤 */
  checkableNames = $derived(this.batchNames.filter((n) => this.checkableOf(n)));
  /** 可送出的數量 */
  checkableCount = $derived(this.checkableNames.length);
  /** 已勾選且可送出的標籤 */
  submittableNames = $derived(this.batchNames.filter((n) => this.checked[n] && this.checkableOf(n)));
  /** 已勾選且可送出的數量 */
  submittableCount = $derived(this.submittableNames.length);
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
    for (const n of this.pagination.items) {
      if (this.checkableOf(n)) checked[n] = true;
    }

    this.checked = checked;
  }

  /** 開啟審查清單，從第一批開始 */
  handleOpen = () => {
    this.submit.clearFailures();
    this.moveTo(1);
    this.open = true;
  };

  /** 關閉審查清單（送出進行中時不允許關閉） */
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
  handleToggle = (name: string) => {
    if (this.checked[name]) delete this.checked[name];
    else this.checked[name] = true;
  };

  /** 全選／全不選本批目前可勾選的項目 */
  handleToggleAll = () => {
    const eligible = this.checkableNames;
    const allSelected = eligible.length > 0 && eligible.every((n) => this.checked[n]);
    for (const n of eligible) {
      if (allSelected) delete this.checked[n];
      else this.checked[n] = true;
    }
  };

  /** 送出本批可送出的項目；成功的會被 submit 自己自異動區移除，這裡只負責同步 checked 狀態 */
  handleSubmit = async () => {
    const names = this.submittableNames;
    await this.submit.handleSubmit(names);

    const failures = this.submit.lastFailures;
    for (const n of names) if (!(n in failures)) delete this.checked[n];
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
