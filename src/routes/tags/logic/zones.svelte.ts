/**
 * @file zones.svelte.ts
 * 管理每個標籤被排入哪一個異動區
 */

import { getContext, setContext } from "svelte";
import { SvelteMap } from "svelte/reactivity";
import type { Tag } from "$lib/database";

/** 標籤所在的一個位置；`pool` 代表回到標籤池，也就是自所有異動區移除 */
export type ZoneTarget =
  | { kind: "pool" }
  | { kind: "new-group" }
  | { kind: "delete" }
  | { kind: "hidden" }
  | { kind: "group"; id: string };

/** 一個標籤異動區，刪除與隱藏切換區是固定、永不刪除的單例，合併或重命名區則是動態新增/移除 */
export type Zone =
  | { kind: "delete"; tags: Tag[] }
  | { kind: "hidden"; tags: Tag[] }
  | { kind: "group"; id: string; canonical: string; tags: Tag[] };

class ZonesController {
  /** 合併與重命名區映射，動態增減 */
  private groupMap = new SvelteMap<string, Extract<Zone, { kind: "group" }>>();

  /** 刪除區，永不刪除的單例 */
  delete: Extract<Zone, { kind: "delete" }> = $state({ kind: "delete", tags: [] });
  /** 隱藏切換區，永不刪除的單例 */
  hidden: Extract<Zone, { kind: "hidden" }> = $state({ kind: "hidden", tags: [] });
  /** 合併與重命名區 */
  groups: readonly Extract<Zone, { kind: "group" }>[] = $derived([...this.groupMap.values()]);
  /** 目前的所有異動區，順序與畫面呈現順序一致 */
  all: readonly Zone[] = $derived([...this.groupMap.values(), this.delete, this.hidden]);

  // ---

  /** 把標籤自所有區移除（同一標籤只可能落在一處）；合併區被移光成員時整區消失 */
  private detach(name: string) {
    for (const zone of this.all) {
      if (!zone.tags.some((t) => t.name === name)) continue;

      zone.tags = zone.tags.filter((t) => t.name !== name);
      if (zone.kind === "group" && zone.tags.length === 0) this.groupMap.delete(zone.id);
      return;
    }
  }

  /** 由指定標籤建立一個新的合併區，主名稱預設為使用數最高的那個 */
  private createGroup(tags: Tag[]) {
    for (const t of tags) this.detach(t.name);

    const canonical = tags.toSorted((a, b) => b.count - a.count)[0].name;
    const id = crypto.randomUUID();
    // 放進 SvelteMap 只讓「有哪些區」響應式，區的內容要自己是 $state 才會通知
    const zone = $state<Extract<Zone, { kind: "group" }>>({ kind: "group", id, canonical, tags: [...tags] });

    this.groupMap.set(id, zone);
  }

  /** 把標籤加入指定區，已在該區的略過 */
  private addTo(zone: Zone, tags: Tag[]) {
    for (const t of tags) {
      if (zone.tags.some((m) => m.name === t.name)) continue;
      this.detach(t.name);
      zone.tags.push(t);
    }
  }

  // ---

  /** 把標籤排進指定區 */
  handleAssign = (target: ZoneTarget, tags: Tag[]) => {
    if (tags.length === 0) return;

    switch (target.kind) {
      case "pool":
        for (const t of tags) this.detach(t.name);
        break;
      case "new-group":
        this.createGroup(tags);
        break;
      case "delete":
        this.addTo(this.delete, tags);
        break;
      case "hidden":
        this.addTo(this.hidden, tags);
        break;
      case "group": {
        const zone = this.groupMap.get(target.id);
        if (zone !== undefined) this.addTo(zone, tags);
        break;
      }
    }
  };

  /** 把標籤移出所在區 */
  handleDetach = (names: string[]) => {
    for (const n of names) this.detach(n);
  };

  /** 設定合併後或重命名區的名稱輸入 */
  handleRename = (groupId: string, canonical: string) => {
    const zone = this.groupMap.get(groupId);
    if (zone === undefined) return;
    zone.canonical = canonical;
  };

  /** 清空指定區 */
  handleDissolve = (target: ZoneTarget) => {
    switch (target.kind) {
      case "group":
        this.groupMap.delete(target.id);
        break;
      case "delete":
        this.delete.tags = [];
        break;
      case "hidden":
        this.hidden.tags = [];
        break;
    }
  };

  /** 清空所有區 */
  handleClearAll = () => {
    this.groupMap.clear();
    this.delete.tags = [];
    this.hidden.tags = [];
  };
}

const key = Symbol("zones-controller");

export const createZonesContext = () => {
  const controller = new ZonesController();
  setContext(key, controller);
  return controller;
};

export const getZonesContext = () => getContext<ZonesController>(key);
