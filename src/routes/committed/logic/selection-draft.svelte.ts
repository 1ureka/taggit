/**
 * @file selection-draft.svelte.ts
 * 管理多選模式下、套用前的批次編輯表單草稿
 */

import { SvelteSet } from "svelte/reactivity";
import { getContext, setContext } from "svelte";
import { getSelectionContext } from "./selection.svelte";
import { getDraftsContext } from "./drafts.svelte";
import { getRevertMarkContext } from "./reverts.svelte";

type Field = "revert" | "rating" | "addTags" | "removeTags";

class SelectionDraftController {
  private selection = getSelectionContext();
  private drafts = getDraftsContext();
  private reverts = getRevertMarkContext();

  checked = new SvelteSet<Field>();
  revert = $state<"mark" | "unmark">("mark");
  rating = $state(0);
  addTags = $state<string[]>([]);
  removeTags = $state<string[]>([]);

  /** 標記退回時，評等／加標籤／去標籤三個欄位視為無效 */
  locked = $derived(this.checked.has("revert") && this.revert === "mark");

  /** 是否有需要套用的操作 */
  dirty = $derived.by(() => {
    if (this.checked.has("revert") || this.checked.has("rating")) return true;
    if (this.checked.has("addTags") && this.addTags.length > 0) return true;
    if (this.checked.has("removeTags") && this.removeTags.length > 0) return true;
  });

  constructor() {
    // 離開多選模式視為結束這次批次操作，草稿一併清空
    $effect(() => {
      if (!this.selection.active) this.reset();
    });
  }

  private reset() {
    this.checked.clear();
    this.revert = "mark";
    this.rating = 0;
    this.addTags = [];
    this.removeTags = [];
  }

  // ---

  handleCheck = (field: Field, value: boolean) => {
    if (value) this.checked.add(field);
    else this.checked.delete(field);
  };

  handleRevertChange = (direction: "mark" | "unmark") => {
    this.revert = direction;
  };

  handleRatingChange = (value: number) => {
    this.rating = value;
  };

  handleTagsChange = (type: "add" | "remove", tags: string[]) => {
    if (type === "add") this.addTags = tags;
    if (type === "remove") this.removeTags = tags;
  };

  /** 把已勾選欄位依目前值套用到所有選取圖片的草稿，並重置表單 */
  handleApply = () => {
    const files = this.selection.selectedFiles;

    if (this.checked.has("revert")) {
      if (this.revert === "mark") this.reverts.handleMark(files);
      else this.reverts.handleUnmark(files);
    }

    if (!this.locked) {
      if (this.checked.has("rating")) this.drafts.handleSetRating(files, this.rating);
      if (this.checked.has("addTags")) this.drafts.handleAddTags(files, this.addTags);
      if (this.checked.has("removeTags")) this.drafts.handleRemoveTags(files, this.removeTags);
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
