/**
 * @file pinned.ts
 * /compare 已釘選圖片的 controller。管理 pinnedIds 與其對應紀錄的存取／切換／隨機抽選，
 * 讀取時去重（見 issues/route_compare.md 第 5 條），並在目前結果集（`data.items`，受篩選/排序影響）
 * 變動時，主動剔除已不在其中的 pinned id——原本這類孤兒 id 一旦離開可見結果集就再也沒有 UI
 * 能移除它，會永久卡在 URL 的 `pinned` 參數中（見 issues/route_compare.md 第 3 條）。
 */

import { getContext, setContext, untrack } from "svelte";
import { page } from "$app/state";
import { replaceState } from "$app/navigation";
import { addToast } from "$lib/components/floating/toast-events";
import type { ImageWithId } from "$lib/database";
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
  private idsSet = $derived.by(() => new Set(this.idsState));

  private recordsById = $derived.by(() => new Map(this.pageData.value.items.map((r) => [r.id, r])));

  /** 目前釘選、且仍存在於目前結果集內的紀錄 */
  records = $derived.by(() =>
    this.idsState.map((id) => this.recordsById.get(id)).filter((r): r is ImageWithId => r !== undefined),
  );

  get ids(): string[] {
    return this.idsState;
  }

  isPinned = (id: string) => this.idsSet.has(id);

  constructor() {
    // 上一頁/下一頁或其他外部原因造成 URL 的 pinned 參數變動時才回灌；自己造成的變動已由 commit() 同步 echo
    $effect(() => {
      const urlIds = parsePinnedIds(page.url.searchParams);
      if (urlIds.join(",") !== this.echo.join(",")) this.idsState = urlIds;
      this.echo = urlIds;
    });

    // 篩選/排序改變導致結果集變動時，剔除已不在其中的孤兒 pinned id
    $effect(() => {
      const validIds = new Set(this.pageData.value.items.map((r) => r.id));
      const next = this.idsState.filter((id) => validIds.has(id));
      if (next.length !== this.idsState.length) this.commit(next);
    });
  }

  private commit(next: string[]) {
    this.idsState = next;
    this.echo = next;
    const params = new URLSearchParams(page.url.searchParams);
    if (next.length > 0) params.set("pinned", next.join(","));
    else params.delete("pinned");
    const qs = params.toString();
    replaceState(`${page.url.pathname}${qs ? `?${qs}` : ""}`, page.state);
  }

  handleTogglePin = (id: string) => {
    const next = this.idsState.includes(id) ? this.idsState.filter((x) => x !== id) : [...this.idsState, id];
    this.commit(next);
  };

  handleUnpin = (id: string) => {
    if (!this.idsState.includes(id)) return;
    this.commit(this.idsState.filter((x) => x !== id));
  };

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
