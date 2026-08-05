/**
 * @file query.svelte.ts
 * 決定這一頁看到哪些建議（分類頁籤與忽略清單，純前端篩選），以及重新整理
 */

import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { goto } from "$app/navigation";
import { addToast } from "$lib/components/floating/toast-events";
import { getPageDataContext, type Suggestion } from "./page-data.svelte";

type Kind = Suggestion["kind"];
export type Tab = "all" | Kind;

export const KIND_LABELS: Record<Kind, string> = {
  similar: "名稱近似",
  cooccur: "高度共現",
  rare: "冷門標籤",
  unused: "零使用",
};

class QueryController {
  private pageData = getPageDataContext();
  /** 使用者忽略、暫時不想再看到的建議 id */
  private dismissed = new SvelteSet<string>();

  constructor() {
    // 建議清單重算後，上一輪的忽略不再適用。刻意不寫在 `handleRefresh` 裡——
    // 送出成功後 `submit` 也會重跑 load，那條路徑不經過 `handleRefresh`
    $effect(() => {
      this.pageData.value.suggestions;
      this.dismissed.clear();
    });
  }

  /** 目前選取的分類頁籤；它是使用者當下的視角，不隨建議重算重置 */
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

  // ---

  /** 是否有一次重新整理正在進行中 */
  refreshing = $state(false);

  /** 重新整理，重算建議清單 */
  handleRefresh = async () => {
    if (this.refreshing) return;

    this.refreshing = true;
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
      addToast({ message: "建議已重新計算", variant: "success" });
    } catch (e) {
      addToast({ message: "重新整理失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.refreshing = false;
    }
  };
}

const key = Symbol("query-controller");

export const createQueryContext = () => {
  const controller = new QueryController();
  setContext(key, controller);
  return controller;
};

export const getQueryContext = () => getContext<QueryController>(key);
