/**
 * @file merge-count.svelte.ts
 * 查詢每個合併區合併後的預估圖片張數
 */

import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import { api } from "$lib/utils/request";

import { getZonesContext } from "./zones.svelte";

class MergeCountController {
  private zones = getZonesContext();

  /** 每個合併區合併後的預估張數 */
  private counts = new SvelteMap<string, number>();
  /** 每個合併區上次排程查詢時的組成簽章，純比對用，刻意不是響應式狀態以免自我觸發 */
  private signatures = new Map<string, string>();
  /** 每個合併區的 debounce 計時器與流水號 */
  private timers = new Map<string, { timer: ReturnType<typeof setTimeout>; seq: number }>();

  /** 指定合併區合併後的預估張數，尚在查詢中為 `null` */
  countOf = (groupId: string): number | null => this.counts.get(groupId) ?? null;

  constructor() {
    // 合併區的組成有變就重新排程；已消失的合併區連同在途查詢一起清掉。
    $effect(() => {
      const groups = this.zones.groups;
      const alive = new Set(groups.map((g) => g.id));

      for (const id of [...this.signatures.keys()]) {
        if (!alive.has(id)) this.drop(id);
      }

      for (const g of groups) {
        const names = [g.canonical.trim(), ...g.tags.map((t) => t.name)];
        const signature = names.join("\0");
        if (this.signatures.get(g.id) === signature) continue;

        this.signatures.set(g.id, signature);
        this.counts.delete(g.id); // 回到查詢中，畫面顯示骨架
        this.schedule(g.id, names);
      }
    });

    // 這個 effect 沒有依賴、永遠不會重跑，只在元件銷毀時清掉所有在途查詢
    $effect(() => {
      return () => {
        for (const id of [...this.signatures.keys()]) this.drop(id);
      };
    });
  }

  /** 移除一組的查詢狀態與在途查詢 */
  private drop(groupId: string) {
    const pending = this.timers.get(groupId);
    if (pending) clearTimeout(pending.timer);

    this.timers.delete(groupId);
    this.signatures.delete(groupId);
    this.counts.delete(groupId);
  }

  /** 排程一次查詢，較早送出、已過期的回應由流水號作廢 */
  private schedule(groupId: string, names: string[]) {
    const prev = this.timers.get(groupId);
    if (prev) clearTimeout(prev.timer);
    const seq = (prev?.seq ?? 0) + 1;

    const timer = setTimeout(async () => {
      // 一個合併區一次請求：每區的組成各自獨立變動，合併成一次反而要自己處理誰過期
      const res = await api.post<{ union: number }>("/api/tags/counts", { names });

      if (this.timers.get(groupId)?.seq !== seq) return; // 在途回應已過期
      if (!res.ok) return; // 查詢失敗不打擾操作，下次變動再試

      this.counts.set(groupId, res.data.union);
    }, 300);

    this.timers.set(groupId, { timer, seq });
  }
}

const key = Symbol("merge-count-controller");

export const createMergeCountContext = () => {
  const controller = new MergeCountController();
  setContext(key, controller);
  return controller;
};

export const getMergeCountContext = () => getContext<MergeCountController>(key);
