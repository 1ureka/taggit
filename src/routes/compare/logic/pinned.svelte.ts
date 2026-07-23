/**
 * @file pinned.ts
 * 管理已釘選圖片
 */

import { getContext, setContext } from "svelte";
import { addToast } from "$lib/components/floating/toast-events";
import { shallowSearchParam, type Codec } from "$lib/utils/search-params.svelte";
import { getPageDataContext } from "./page-data.svelte";

/** `pinned` 參數的編碼方式：逗號分隔、去重、去空白 */
const idsCodec: Codec<string[]> = {
  parse: (raw) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of (raw ?? "").split(",")) {
      const id = part.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  },
  serialize: (ids) => (ids.length > 0 ? ids.join(",") : null),
};

class PinnedController {
  private pageData = getPageDataContext();
  private params = shallowSearchParam("pinned", idsCodec);

  private idsSet = $derived(new Set(this.params.value));
  private recordsById = $derived(new Map(this.pageData.value.items.map((r) => [r.id, r])));

  constructor() {
    // 查詢結果變動時，剔除已不在其中的 pinned id
    $effect(() => {
      const validIds = new Set(this.pageData.value.items.map((r) => r.id));
      const next = this.params.value.filter((id) => validIds.has(id));
      if (next.length !== this.params.value.length) this.params.commit(next);
    });
  }

  /** 目前釘選、且仍存在於目前查詢結果內的紀錄 */
  records = $derived(this.params.value.map((id) => this.recordsById.get(id)).filter((r) => r !== undefined));

  /** 給定的圖片 id 對應的圖片是否被釘選中 */
  isPinned = (id: string) => this.idsSet.has(id);

  /** 切換指定 id 圖片的釘選狀態 */
  handleTogglePin = (id: string) => {
    const ids = this.params.value;
    this.params.commit(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };

  /** 取消指定 id 圖片的釘選狀態 */
  handleUnpin = (id: string) => {
    const ids = this.params.value;
    if (!ids.includes(id)) return;
    this.params.commit(ids.filter((x) => x !== id));
  };

  /** 重新隨機釘選 N 張圖片 */
  handleShuffle = (count: number) => {
    const pool = this.pageData.value.items;
    if (pool.length === 0) {
      addToast({ message: "沒有可抽選的圖片", variant: "error" });
      return;
    }

    const n = Math.min(count, pool.length);
    const indices = new Set<number>();
    while (indices.size < n) indices.add(Math.floor(Math.random() * pool.length));

    this.params.commit([...indices].map((i) => pool[i].id));
  };
}

const key = Symbol("pinned-controller");

export const createPinnedContext = () => {
  const controller = new PinnedController();
  setContext(key, controller);
  return controller;
};

export const getPinnedContext = () => getContext<PinnedController>(key);
