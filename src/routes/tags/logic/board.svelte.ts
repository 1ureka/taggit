/**
 * @file board.svelte.ts
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

/** 扁平化標籤異動區後，畫布上每個標籤各一筆的異動 */
export type TagOperation =
  | { kind: "rename" | "merge"; name: string; count: number; to: string; groupId: string }
  | { kind: "delete"; name: string; count: number }
  | { kind: "hidden" | "visible"; name: string; count: number };

/** 扁平化單個標籤異動區至每個標籤的異動 */
function buildOperation(zone: Zone): TagOperation[] {
  const ops: TagOperation[] = [];

  if (zone.kind === "group") {
    const canonical = zone.canonical.trim();
    const kind = zone.tags.length > 1 ? "merge" : "rename";

    for (const { name, count } of zone.tags) {
      if (name === canonical) continue;
      ops.push({ kind, name, count, to: canonical, groupId: zone.id });
    }
  }

  if (zone.kind === "delete") {
    for (const { name, count } of zone.tags) ops.push({ kind: "delete", name, count });
  }

  if (zone.kind === "hidden") {
    for (const { name, count, meta } of zone.tags) ops.push({ kind: meta.hidden ? "visible" : "hidden", name, count });
  }

  return ops;
}

// ---

/** 合併後的名稱長度上限，與 `Mutation.renameTag` 的驗證一致 */
const MAX_NAME_LENGTH = 50;

class BoardController {
  /** 合併與重命名區映射，動態增減 */
  private groupMap = new SvelteMap<string, Extract<Zone, { kind: "group" }>>();

  /** 刪除區，永不刪除的單例 */
  deleteZone: Extract<Zone, { kind: "delete" }> = $state({ kind: "delete", tags: [] });
  /** 隱藏切換區，永不刪除的單例 */
  hiddenZone: Extract<Zone, { kind: "hidden" }> = $state({ kind: "hidden", tags: [] });
  /** 合併與重命名區 */
  groupZones: readonly Extract<Zone, { kind: "group" }>[] = $derived([...this.groupMap.values()]);
  /** 目前的所有異動區 */
  zones: readonly Zone[] = $derived([...this.groupMap.values(), this.deleteZone, this.hiddenZone]);

  /**
   * 畫布上全部的標籤異動，維持區的呈現順序，**不應加入任何過濾**。
   * 同時是離頁守衛與審查清單的唯一依據。
   *
   * `name` 在此陣列中唯一——同一標籤只會落在一個區，且合併區會跳過與主名稱同名的成員。
   * `/api/proto/tags-batch` 用裸標籤名當結果鍵能對得上，正是靠這條不變式。
   */
  operations = $derived(this.zones.flatMap(buildOperation));

  /** 每個標籤目前所在的區域種類查找表 */
  // COMMENT: 這不是投影嗎? 怎麼在這裡?
  chipStatus = $derived.by(() => {
    const m = new Map<string, "group" | "delete" | "hidden">();
    for (const zone of this.zones) for (const t of zone.tags) m.set(t.name, zone.kind);
    return m;
  });

  private operationsByName = $derived(new Map(this.operations.map((op) => [op.name, op])));

  /** 指定標籤目前的異動內容，不在畫布上時為 `undefined` */
  operationOf(name: string): TagOperation | undefined {
    return this.operationsByName.get(name);
  }

  /** 指定標籤的異動是否有問題，以及在有問題時的描述；不在畫布上時恆為 `null` */
  problemOf(name: string): string | null {
    const op = this.operationOf(name);
    if (op === undefined) return null;
    if (op.kind !== "rename" && op.kind !== "merge") return null;

    const to = op.to;
    if (to.length === 0 || to.length > MAX_NAME_LENGTH || to.includes(",")) {
      return `新名稱不合法（1–${MAX_NAME_LENGTH} 字元、不可含逗號）`;
    }

    const conflict = this.operationOf(to);
    if (conflict?.kind === "rename" || conflict?.kind === "merge") return `目標「${to}」本身也被排入重新命名`;
    if (conflict?.kind === "delete") return `目標「${to}」已被排入刪除`;

    return null;
  }

  // ---

  /** 把標籤自所有區移除（同一標籤只可能落在一處）；合併區被移光成員時整區消失 */
  private detach(name: string) {
    for (const zone of this.zones) {
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
        this.addTo(this.deleteZone, tags);
        break;
      case "hidden":
        this.addTo(this.hiddenZone, tags);
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
        this.deleteZone.tags = [];
        break;
      case "hidden":
        this.hiddenZone.tags = [];
        break;
    }
  };

  /** 清空所有區 */
  handleClearAll = () => {
    this.groupMap.clear();
    this.deleteZone.tags = [];
    this.hiddenZone.tags = [];
  };
}

const key = Symbol("board-controller");

export const createBoardContext = () => {
  const controller = new BoardController();
  setContext(key, controller);
  return controller;
};

export const getBoardContext = () => getContext<BoardController>(key);
