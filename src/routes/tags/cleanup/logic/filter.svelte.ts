/**
 * @file filter.svelte.ts
 * 建議清單的分類頁籤與忽略狀態。純前端篩選——建議清單本身在 load 時已一次算好，
 * 分類與忽略都不影響資料本身，不需要連帶 goto 重新整理。
 */

import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import type { Suggestion } from "./suggestions";
import { getPageDataContext } from "./page-data.svelte";

type Kind = Suggestion["kind"];
export type Tab = "all" | Kind;

export const KIND_LABELS: Record<Kind, string> = {
  similar: "名稱近似",
  cooccur: "高度共現",
  rare: "冷門標籤",
  unused: "零使用",
};

class FilterController {
  private pageData = getPageDataContext();
  /** 使用者忽略、暫時不想再看到的建議 id；重新整理後會隨建議清單重算而自然清空 */
  private dismissed = new SvelteSet<string>();

  /** 目前選取的分類頁籤 */
  tab = $state<Tab>("all");

  private remaining = $derived(this.pageData.value.suggestions.filter((s) => !this.dismissed.has(s.id)));

  /** 各分類（扣除已忽略）目前的建議數量 */
  kindCounts = $derived.by(() => {
    const m = new Map<Kind, number>();
    for (const s of this.remaining) m.set(s.kind, (m.get(s.kind) ?? 0) + 1);
    return m;
  });

  /** 扣除已忽略後的建議總數 */
  total = $derived(this.remaining.length);

  /** 目前頁籤篩選後可見的建議清單 */
  visible = $derived(this.remaining.filter((s) => this.tab === "all" || s.kind === this.tab));

  handleTabChange = (tab: Tab) => {
    this.tab = tab;
  };

  /** 忽略這則建議（純 UI 層級，不影響任何資料） */
  handleDismiss = (id: string) => {
    this.dismissed.add(id);
  };
}

const key = Symbol("filter-controller");

export const createFilterContext = () => {
  const controller = new FilterController();
  setContext(key, controller);
  return controller;
};

export const getFilterContext = () => getContext<FilterController>(key);
