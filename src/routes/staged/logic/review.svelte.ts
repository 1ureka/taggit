/**
 * @file review.svelte.ts
 * 審查清單：勾選狀態、投影出的清單、標籤庫影響評估、提交流程，以及提交失敗匯總
 */

import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { goto } from "$app/navigation";

import { api } from "$lib/utils/request";
import { formatError } from "$lib/utils/shared";
import { addToast } from "$lib/components/floating/toast-events";

import { commitDrafts, problemOf } from "./draft";
import { buildReviewEntry } from "./review-entry";
import { getEditorContext } from "./editor.svelte";
import { getOperationsContext } from "./operations.svelte";

class ReviewController {
  private editor = getEditorContext();
  private operations = getOperationsContext();

  /** 審查對話框是否開啟 */
  open = $state(false);
  /** 上一次提交後的失敗匯總（filename -> 原因） */
  private failures = $state<Record<string, string>>({});
  /** 目前審查清單的勾選狀態；每次打開時重新全選可提交項目 */
  private checked = new SvelteSet<string>();

  /** 審查清單 */
  entries = $derived(
    this.editor.touchedFiles.map((f) =>
      buildReviewEntry(f, this.editor.draftOf(f), this.checked.has(f), this.failures[f]),
    ),
  );
  /** 已勾選的數量 */
  checkedCount = $derived(this.entries.filter((e) => e.checked).length);
  /** 可勾選的數量 */
  checkableCount = $derived(this.entries.filter((e) => e.checkable).length);
  /** 全選框的三態 */
  bulkSelectionState = $derived.by(() => {
    if (this.checkableCount === 0 || this.checkedCount === 0) return "unchecked";
    if (this.checkableCount === this.checkedCount) return "checked";
    return "indeterminate";
  });

  /** 開啟審查清單，並全選所有目前可提交的項目 */
  handleOpen = () => {
    this.failures = {};
    this.checked.clear();
    for (const f of this.editor.touchedFiles) {
      if (problemOf(this.editor.draftOf(f)) === null) this.checked.add(f);
    }
    this.open = true;
  };

  /** 關閉審查清單（操作進行中時不允許關閉） */
  handleClose = () => {
    if (!this.operations.pending) this.open = false;
  };

  /** 切換單一項目的勾選狀態 */
  handleToggle = (filename: string) => {
    if (this.checked.has(filename)) this.checked.delete(filename);
    else this.checked.add(filename);
  };

  /** 全選／全不選目前可勾選的項目 */
  handleToggleAll = () => {
    const eligible = this.entries.filter((e) => e.checkable);
    const allSelected = eligible.length > 0 && eligible.every((e) => e.checked);
    for (const e of eligible) {
      if (allSelected) this.checked.delete(e.filename);
      else this.checked.add(e.filename);
    }
  };

  /** 從審查清單回到某張圖片繼續編輯 */
  handleEdit = (filename: string) => {
    this.open = false;
    this.editor.handleSelect(filename);
  };

  // ---

  /** 目前草稿中有的標籤  */
  private touchedTagNames = $derived.by(() => {
    const set = new Set<string>();
    for (const e of this.entries) {
      if (!e.checked) continue;
      for (const t of e.tags) set.add(t);
    }
    return [...set];
  });

  /** 是否有一次查詢正在等待中，含 debounce 等待期 */
  private pendingFetch = $state(false);
  impactLoading = $derived(this.open && this.pendingFetch);

  private impactCounts = $state(new Map<string, number>());
  private impactSeq = 0;
  private impactTimer: ReturnType<typeof setTimeout> | undefined;

  /** 提交後會新增的全新標籤（目前全域使用數為 0） */
  newTags = $derived(this.touchedTagNames.filter((t) => (this.impactCounts.get(t) ?? 0) === 0));

  constructor() {
    $effect(() => {
      const names = this.touchedTagNames;
      clearTimeout(this.impactTimer);

      if (!this.open || names.length === 0) {
        this.pendingFetch = false;
        return;
      }

      this.pendingFetch = true; // 立刻進入 loading，不受下面的 debounce 影響
      const seq = ++this.impactSeq;
      this.impactTimer = setTimeout(async () => {
        const res = await api.get<{ counts: { name: string; count: number }[] }>(
          `/api/proto/tags-impact?names=${encodeURIComponent(names.join(","))}`,
        );
        if (seq !== this.impactSeq) return; // 已有更新的查詢在路上，這次回應作廢
        if (res.ok && res.data) this.impactCounts = new Map(res.data.counts.map((c) => [c.name, c.count]));
        this.pendingFetch = false; // 套用完成才解除 loading
      }, 200);
    });
  }

  // ---

  /** 提交目前勾選的暫存圖片 */
  handleSubmit = async () => {
    const filenames = this.entries.filter((e) => e.checked).map((e) => e.filename);
    if (filenames.length === 0 || this.operations.pending) return;

    this.operations.pending = true;
    try {
      const result = await commitDrafts(filenames.map((f) => ({ filename: f, draft: this.editor.draftOf(f) })));
      this.failures = Object.fromEntries(result);

      const committed = filenames.filter((f) => !result.has(f));
      this.editor.removeDrafts(committed);
      for (const f of committed) this.checked.delete(f);

      if (committed.length > 0) addToast({ message: `已提交 ${committed.length} 張圖片`, variant: "success" });
      if (result.size > 0) addToast({ message: `${result.size} 張提交失敗`, variant: "error" });
      if (result.size === 0) this.open = false;

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      this.operations.pending = false;
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
