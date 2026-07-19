/**
 * @file selection.svelte.ts
 * 標籤池內的多選狀態
 */

import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { Tag } from "$lib/database";

class SelectionController {
  private tagsByName = new SvelteMap<string, Tag>();

  /** 目前選取的數量 */
  get size() {
    return this.tagsByName.size;
  }

  /** 指定標籤名稱是否被選取中 */
  isSelected = (name: string) => this.tagsByName.has(name);

  /** 切換指定標籤的選取狀態 */
  handleToggle = (tag: Tag) => {
    if (this.tagsByName.has(tag.name)) this.tagsByName.delete(tag.name);
    else this.tagsByName.set(tag.name, tag);
  };

  /** 清空選取 */
  handleClear = () => {
    this.tagsByName.clear();
  };

  /** 取出目前選取的標籤並清空——「抓一次性快照 + 清空」永遠成對出現，收成一個原子方法 */
  consume = (): Tag[] => {
    const tags = [...this.tagsByName.values()];
    this.tagsByName.clear();
    return tags;
  };
}

const key = Symbol("selection-controller");

export const createSelectionContext = () => {
  const controller = new SelectionController();
  setContext(key, controller);
  return controller;
};

export const getSelectionContext = () => getContext<SelectionController>(key);
