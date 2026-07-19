/**
 * @file pinned.ts
 * 管理已釘選圖片
 */

import { getContext, setContext, untrack } from "svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/state";
import { addToast } from "$lib/components/floating/toast-events";
import { getPageDataContext } from "./page-data.svelte";

function parsePinnedIds(params: URLSearchParams): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of (params.get("pinned") ?? "").split(",")) {
    const id = raw.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }

  return out;
}

class PinnedController {
  private pageData = getPageDataContext();

  private echo = untrack(() => parsePinnedIds(page.url.searchParams));
  private idsState = $state(this.echo);
  private idsSet = $derived(new Set(this.idsState));

  private recordsById = $derived(new Map(this.pageData.value.items.map((r) => [r.id, r])));

  /** 目前釘選、且仍存在於目前結果集內的紀錄 */
  records = $derived(this.idsState.map((id) => this.recordsById.get(id)).filter((r) => r !== undefined));

  /** 給定的圖片 id 對應的圖片是否被釘選中 */
  isPinned = (id: string) => this.idsSet.has(id);

  constructor() {
    // 上一頁/下一頁或其他外部原因造成 URL 的 pinned 參數變動時
    $effect(() => {
      const urlIds = parsePinnedIds(page.url.searchParams);
      if (urlIds.join(",") !== this.echo.join(",")) this.idsState = urlIds;
      this.echo = urlIds;
    });

    // 篩選/排序改變導致結果集變動時，剔除已不在其中的 pinned id
    $effect(() => {
      const validIds = new Set(this.pageData.value.items.map((r) => r.id));
      const next = this.idsState.filter((id) => validIds.has(id));
      if (next.length !== this.idsState.length) this.commit(next);
    });
  }

  private commit(next: string[]) {
    this.idsState = next;
    this.echo = next;
    const params = new URLSearchParams(location.search);
    if (next.length > 0) params.set("pinned", next.join(","));
    else params.delete("pinned");
    const qs = params.toString();
    replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
  }

  /** 切換指定 id 圖片的釘選狀態 */
  handleTogglePin = (id: string) => {
    const next = this.idsState.includes(id) ? this.idsState.filter((x) => x !== id) : [...this.idsState, id];
    this.commit(next);
  };

  /** 取消指定 id 圖片的釘選狀態 */
  handleUnpin = (id: string) => {
    if (!this.idsState.includes(id)) return;
    this.commit(this.idsState.filter((x) => x !== id));
  };

  /** 重新隨機釘選 N 章圖片 */
  handleShuffle = (count: number) => {
    const pool = this.pageData.value.items;
    if (pool.length === 0) {
      addToast({ message: "沒有可抽選的圖片", variant: "error" });
      return;
    }

    const n = Math.min(count, pool.length);
    const indices = new Set<number>();
    while (indices.size < n) indices.add(Math.floor(Math.random() * pool.length));

    this.commit([...indices].map((i) => pool[i].id));
  };
}

const key = Symbol("pinned-controller");

export const createPinnedContext = () => {
  const controller = new PinnedController();
  setContext(key, controller);
  return controller;
};

export const getPinnedContext = () => getContext<PinnedController>(key);
