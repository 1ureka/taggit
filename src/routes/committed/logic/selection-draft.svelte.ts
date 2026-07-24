/**
 * @file selection-draft.svelte.ts
 * 管理多選模式下、套用前的批次編輯表單草稿
 */

import { getContext, setContext } from "svelte";
import { getSelectionContext } from "./selection.svelte";
import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";

class SelectionDraftController {
  private selection = getSelectionContext();
  private drafts = getDraftsContext();
  private reverts = getRevertMarkContext();

  revertChecked = $state(false);
  revertDirection = $state<"mark" | "unmark">("mark");

  ratingChecked = $state(false);
  ratingValue = $state(0);

  addTagsChecked = $state(false);
  addTagsValue = $state<string[]>([]);

  removeTagsChecked = $state(false);
  removeTagsValue = $state<string[]>([]);

  /** 標記退回時，評等／加標籤／去標籤三個欄位視為無效 */
  locked = $derived(this.revertChecked && this.revertDirection === "mark");

  constructor() {
    // 離開多選模式視為結束這次批次操作，草稿一併清空
    $effect(() => {
      if (!this.selection.active) this.reset();
    });
  }

  private reset() {
    this.revertChecked = false;
    this.revertDirection = "mark";
    this.ratingChecked = false;
    this.ratingValue = 0;
    this.addTagsChecked = false;
    this.addTagsValue = [];
    this.removeTagsChecked = false;
    this.removeTagsValue = [];
  }

  /** 把已勾選欄位依目前值套用到所有選取圖片的草稿，並重置表單 */
  handleApply = () => {
    const files = this.selection.selectedFiles;

    if (this.revertChecked) {
      if (this.revertDirection === "mark") this.reverts.handleMark(files);
      else this.reverts.handleUnmark(files);
    }

    if (!this.locked) {
      if (this.ratingChecked) this.drafts.handleSetRating(files, this.ratingValue);
      if (this.addTagsChecked) this.drafts.handleAddTags(files, this.addTagsValue);
      if (this.removeTagsChecked) this.drafts.handleRemoveTags(files, this.removeTagsValue);
    }

    this.reset();
  };
}

const key = Symbol("selection-draft-controller");

export const createSelectionDraftContext = () => {
  const controller = new SelectionDraftController();
  setContext(key, controller);
  return controller;
};

export const getSelectionDraftContext = () => getContext<SelectionDraftController>(key);
