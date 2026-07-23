/**
 * @file selection.svelte.ts
 * 管理批次選取模式的啟用狀態與選取狀態
 */
import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { getPageDataContext } from "./page-data.svelte";

class SelectionController {
  private pageData = getPageDataContext();

  private ids = new SvelteSet<string>();

  /** 批次選取模式是否開啟 */
  active = $state(false);
  /** 目前選取的檔名列表 */
  selectedFiles = $derived([...this.ids]);
  /** 目前選取張數 */
  count = $derived(this.ids.size);
  /** 全選框的三態 */
  bulkSelectionState = $derived.by(() => {
    const total = this.pageData.value.items.length;
    if (total === 0 || this.count === 0) return "unchecked" as const;
    if (this.count === total) return "checked" as const;
    return "indeterminate" as const;
  });

  /** 指定的檔案是否被選取中 */
  isSelected = (id: string) => this.ids.has(id);

  handleToggleMode = () => {
    this.active = !this.active;
    if (!this.active) this.ids.clear();
  };

  handleToggle = (filename: string) => {
    if (this.ids.has(filename)) this.ids.delete(filename);
    else this.ids.add(filename);
  };

  handleToggleAllVisible = () => {
    const allIds = this.pageData.value.items.map((r) => r.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => this.ids.has(id));
    for (const id of allIds) {
      if (allSelected) this.ids.delete(id);
      else this.ids.add(id);
    }
  };
}

const key = Symbol("selection-controller");

export const createSelectionContext = () => {
  const controller = new SelectionController();
  setContext(key, controller);
  return controller;
};

export const getSelectionContext = () => getContext<SelectionController>(key);
